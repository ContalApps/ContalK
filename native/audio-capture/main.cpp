#define NOMINMAX
#include <windows.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <mmdeviceapi.h>
#include <tlhelp32.h>
#include <dwmapi.h>
#include <wrl.h>
#include <wrl/implements.h>
#include <fcntl.h>
#include <io.h>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <deque>
#include <map>
#include <memory>
#include <set>
#include <string>
#include <thread>
#include <vector>

using namespace Microsoft::WRL;
constexpr int SampleRate = 48000;
constexpr int Channels = 2;
constexpr int BlockFrames = 480;

class Activation final : public RuntimeClass<RuntimeClassFlags<ClassicCom>, IActivateAudioInterfaceCompletionHandler, FtmBase> {
public:
    HANDLE done = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    HRESULT result = E_FAIL;
    ComPtr<IAudioClient> client;
    ~Activation() { CloseHandle(done); }
    STDMETHODIMP ActivateCompleted(IActivateAudioInterfaceAsyncOperation* operation) override {
        ComPtr<IUnknown> value;
        HRESULT activationResult = E_FAIL;
        result = operation->GetActivateResult(&activationResult, &value);
        if (SUCCEEDED(result)) result = activationResult;
        if (SUCCEEDED(result)) result = value.As(&client);
        SetEvent(done);
        return S_OK;
    }
};

class Capture {
    ComPtr<IAudioClient> client;
    ComPtr<IAudioCaptureClient> capture;
    std::deque<float> samples;
public:
    bool failed = false;
    HRESULT start(DWORD pid) {
        AUDIOCLIENT_ACTIVATION_PARAMS activation{};
        activation.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
        activation.ProcessLoopbackParams.TargetProcessId = pid;
        activation.ProcessLoopbackParams.ProcessLoopbackMode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;
        PROPVARIANT params{};
        params.vt = VT_BLOB;
        params.blob.cbSize = sizeof(activation);
        params.blob.pBlobData = reinterpret_cast<BYTE*>(&activation);
        auto completion = Make<Activation>();
        ComPtr<IActivateAudioInterfaceAsyncOperation> operation;
        HRESULT hr = ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK, __uuidof(IAudioClient), &params, completion.Get(), &operation);
        if (FAILED(hr)) return hr;
        if (WaitForSingleObject(completion->done, 5000) != WAIT_OBJECT_0) return HRESULT_FROM_WIN32(ERROR_TIMEOUT);
        if (FAILED(completion->result)) return completion->result;
        client = completion->client;
        WAVEFORMATEX format{};
        format.wFormatTag = WAVE_FORMAT_IEEE_FLOAT;
        format.nChannels = Channels;
        format.nSamplesPerSec = SampleRate;
        format.wBitsPerSample = 32;
        format.nBlockAlign = Channels * sizeof(float);
        format.nAvgBytesPerSec = SampleRate * format.nBlockAlign;
        hr = client->Initialize(AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_LOOPBACK | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM, 200000, 0, &format, nullptr);
        if (FAILED(hr)) return hr;
        hr = client->GetService(IID_PPV_ARGS(&capture));
        if (FAILED(hr)) return hr;
        return client->Start();
    }
    ~Capture() { if (client) client->Stop(); }
    void mix(std::vector<float>& out) {
        UINT32 frames = 0;
        HRESULT hr = capture->GetNextPacketSize(&frames);
        while (SUCCEEDED(hr) && frames > 0) {
            BYTE* bytes = nullptr;
            DWORD flags = 0;
            hr = capture->GetBuffer(&bytes, &frames, &flags, nullptr, nullptr);
            if (FAILED(hr)) break;
            if (flags & AUDCLNT_BUFFERFLAGS_DATA_DISCONTINUITY) samples.clear();
            const float* data = reinterpret_cast<float*>(bytes);
            for (UINT32 i = 0; i < frames * Channels; ++i) samples.push_back((flags & AUDCLNT_BUFFERFLAGS_SILENT) ? 0.0f : data[i]);
            capture->ReleaseBuffer(frames);
            hr = capture->GetNextPacketSize(&frames);
        }
        if (FAILED(hr)) failed = true;
        // Bound latency after a stalled consumer instead of replaying stale audio.
        while (samples.size() > SampleRate * Channels / 5) samples.pop_front();
        for (size_t i = 0; i < out.size() && !samples.empty(); ++i) {
            const float value = samples.front();
            samples.pop_front();
            if (std::isfinite(value)) out[i] += value;
        }
    }
};

struct Selection {
    HWND window = nullptr;
    RECT monitor{};
    bool isMonitor = false;
    DWORD excluded = 0;
    DWORD probe = 0;
    std::set<DWORD> pids;
    std::map<DWORD, DWORD> parents;
    bool belongsTo(DWORD pid, DWORD parent) const {
        for (int depth = 0; pid && depth < 64; ++depth) {
            if (pid == parent) return true;
            auto it = parents.find(pid);
            if (it == parents.end() || it->second == pid) break;
            pid = it->second;
        }
        return false;
    }
    void addWindow(HWND hwnd) {
        if (!IsWindowVisible(hwnd) || IsIconic(hwnd) || GetWindowTextLengthW(hwnd) == 0) return;
        DWORD cloaked = 0;
        DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, &cloaked, sizeof(cloaked));
        if (cloaked) return;
        wchar_t className[128]{};
        GetClassNameW(hwnd, className, 128);
        if (wcscmp(className, L"Shell_TrayWnd") == 0 || wcscmp(className, L"Progman") == 0 || wcscmp(className, L"WorkerW") == 0) return;
        if (isMonitor) {
            POINT center{monitor.left + (monitor.right - monitor.left) / 2, monitor.top + (monitor.bottom - monitor.top) / 2};
            if (MonitorFromWindow(hwnd, MONITOR_DEFAULTTONULL) != MonitorFromPoint(center, MONITOR_DEFAULTTONULL)) return;
        }
        DWORD pid = 0;
        GetWindowThreadProcessId(hwnd, &pid);
        if (pid && !belongsTo(pid, excluded) && !belongsTo(excluded, pid)) pids.insert(pid);
    }
    std::set<DWORD> refresh() {
        parents.clear(); pids.clear();
        HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        PROCESSENTRY32 entry{}; entry.dwSize = sizeof(entry);
        if (snapshot != INVALID_HANDLE_VALUE) {
            if (Process32First(snapshot, &entry)) do { parents[entry.th32ProcessID] = entry.th32ParentProcessID; } while (Process32Next(snapshot, &entry));
            CloseHandle(snapshot);
        }
        if (probe) pids.insert(probe);
        else if (isMonitor) EnumWindows([](HWND hwnd, LPARAM data) -> BOOL { reinterpret_cast<Selection*>(data)->addWindow(hwnd); return TRUE; }, reinterpret_cast<LPARAM>(this));
        else addWindow(window);
        // A parent loopback already includes its children. Never mix them twice.
        auto roots = pids;
        for (DWORD pid : pids) for (DWORD other : pids) if (pid != other && belongsTo(pid, other)) { roots.erase(pid); break; }
        return roots;
    }
};

int wmain(int argc, wchar_t** argv) {
    Selection selection;
    if (argc == 3 && wcscmp(argv[1], L"--probe") == 0) selection.probe = wcstoul(argv[2], nullptr, 10);
    else if (argc == 5 && wcscmp(argv[1], L"--window") == 0 && wcscmp(argv[3], L"--exclude") == 0) {
        selection.window = reinterpret_cast<HWND>(static_cast<uintptr_t>(_wcstoui64(argv[2], nullptr, 10)));
        selection.excluded = wcstoul(argv[4], nullptr, 10);
        if (!IsWindow(selection.window)) { fprintf(stderr,"{\"error\":\"A janela selecionada foi fechada.\"}\n"); return 1; }
    } else if (argc == 8 && wcscmp(argv[1], L"--monitor") == 0 && wcscmp(argv[6], L"--exclude") == 0) {
        selection.isMonitor = true;
        selection.monitor = { _wtol(argv[2]), _wtol(argv[3]), _wtol(argv[4]), _wtol(argv[5]) };
        selection.excluded = wcstoul(argv[7], nullptr, 10);
    } else { fprintf(stderr,"{\"error\":\"Invalid capture selection\"}\n"); return 1; }
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(hr)) return 1;
    _setmode(_fileno(stdout), _O_BINARY);
    setvbuf(stdout, nullptr, _IONBF, 0);
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_ABOVE_NORMAL);
    std::map<DWORD, std::unique_ptr<Capture>> captures;
    auto update = [&]() -> bool {
        auto pids = selection.refresh();
        for (auto it = captures.begin(); it != captures.end();) {
            if (!pids.count(it->first)) it = captures.erase(it); else ++it;
        }
        for (DWORD pid : pids) {
            if (captures.count(pid)) continue;
            auto capture = std::make_unique<Capture>();
            hr = capture->start(pid);
            if (FAILED(hr)) {
                fprintf(stderr,"{\"error\":\"Falha na captura isolada de audio. E necessario Windows 10 build 20348 ou Windows 11. Nenhum audio geral foi capturado.\",\"code\":%ld}\n", static_cast<long>(hr));
                return false;
            }
            captures[pid] = std::move(capture);
        }
        return true;
    };
    if (!update()) return 2;
    // Probe the API even when the chosen monitor has no application windows.
    if (captures.empty()) {
        Capture probe;
        hr = probe.start(GetCurrentProcessId());
        if (FAILED(hr)) { fprintf(stderr,"{\"error\":\"A captura de audio por aplicativo nao e suportada neste Windows.\"}\n"); return 2; }
    }
    fprintf(stderr,"{\"ready\":true,\"sampleRate\":48000,\"channels\":2}\n"); fflush(stderr);
    auto next = std::chrono::steady_clock::now();
    auto refreshAt = next + std::chrono::seconds(1);
    std::vector<float> output(BlockFrames * Channels);
    float gain = 1.0f;
    while (true) {
        if (!selection.isMonitor && !selection.probe && !IsWindow(selection.window)) break;
        if (std::chrono::steady_clock::now() >= refreshAt) {
            if (!update()) return 2;
            refreshAt = std::chrono::steady_clock::now() + std::chrono::seconds(1);
        }
        std::fill(output.begin(), output.end(), 0.0f);
        for (auto& [pid, capture] : captures) {
            capture->mix(output);
            if (capture->failed) { fprintf(stderr,"{\"error\":\"A captura de audio foi interrompida. Inicie a transmissao novamente.\"}\n"); return 3; }
        }
        float peak = 1.0f;
        for (float value : output) peak = std::max(peak, std::abs(value));
        const float targetGain = 1.0f / peak;
        gain = targetGain < gain ? targetGain : gain + (targetGain - gain) * 0.01f;
        for (float& value : output) value *= gain;
        if (fwrite(output.data(), sizeof(float), output.size(), stdout) != output.size()) break;
        next += std::chrono::milliseconds(10);
        if (next < std::chrono::steady_clock::now() - std::chrono::milliseconds(100)) next = std::chrono::steady_clock::now();
        std::this_thread::sleep_until(next);
    }
    captures.clear(); CoUninitialize();
    return 0;
}
