#define NOMINMAX
#include <windows.h>
#include <gdiplus.h>
#include <shellapi.h>
#include <cstdio>
#include <memory>
#include <string>
using namespace Gdiplus;
static HANDLE completed = nullptr;
static std::unique_ptr<Image> logo;
static ULONGLONG started = 0;
static bool failed = false;
static HFONT titleFont, detailFont;
static void Text(HDC dc, const wchar_t* value, RECT rect, HFONT font, COLORREF color) {
    SelectObject(dc, font); SetTextColor(dc, color); SetBkMode(dc, TRANSPARENT);
    DrawTextW(dc, value, -1, &rect, DT_CENTER | DT_WORDBREAK);
}
static LRESULT CALLBACK WindowProc(HWND window, UINT message, WPARAM w, LPARAM l) {
    switch(message) {
    case WM_TIMER:
        if(WaitForSingleObject(completed,0)==WAIT_OBJECT_0){DestroyWindow(window);return 0;}
        if(GetTickCount64()-started>180000) failed=true;
        InvalidateRect(window,nullptr,FALSE);return 0;
    case WM_CLOSE:
        if(failed) DestroyWindow(window);return 0;
    case WM_LBUTTONUP:
        if(failed) DestroyWindow(window);return 0;
    case WM_ERASEBKGND: return 1;
    case WM_PAINT: {
        PAINTSTRUCT ps;HDC dc=BeginPaint(window,&ps);RECT area;GetClientRect(window,&area);
        HDC buffer=CreateCompatibleDC(dc);HBITMAP bitmap=CreateCompatibleBitmap(dc,area.right,area.bottom);HGDIOBJ previous=SelectObject(buffer,bitmap);
        // Mesmo visual do tema Menta do app: grafite, verde-menta e cantos discretos.
        HBRUSH background=CreateSolidBrush(RGB(11,14,19));FillRect(buffer,&area,background);DeleteObject(background);
        if(logo){Graphics graphics(buffer);graphics.SetInterpolationMode(InterpolationModeHighQualityBicubic);graphics.DrawImage(logo.get(),164,30,72,72);}
        Text(buffer,failed?L"A atualiza\u00e7\u00e3o est\u00e1 demorando":L"Instalando a atualiza\u00e7\u00e3o",{15,122,385,152},titleFont,RGB(233,238,244));
        Text(buffer,failed?L"Abra o ConTalk para verificar. Clique aqui para fechar.":L"O ConTalk fecha e abre de novo sozinho.",{30,160,370,200},detailFont,RGB(174,182,194));
        HBRUSH track=CreateSolidBrush(RGB(27,33,43));RECT bar{40,226,360,232};FillRect(buffer,&bar,track);DeleteObject(track);
        if(!failed){int offset=int((GetTickCount64()-started)%1600)*240/1600;RECT segment{40+offset,226,120+offset,232};HBRUSH mint=CreateSolidBrush(RGB(61,220,151));FillRect(buffer,&segment,mint);DeleteObject(mint);}
        BitBlt(dc,0,0,area.right,area.bottom,buffer,0,0,SRCCOPY);SelectObject(buffer,previous);DeleteObject(bitmap);DeleteDC(buffer);EndPaint(window,&ps);return 0;
    }
    case WM_DESTROY:PostQuitMessage(0);return 0;
    }
    return DefWindowProcW(window,message,w,l);
}
int WINAPI wWinMain(HINSTANCE instance,HINSTANCE,PWSTR,int) {
    int argc;auto argv=CommandLineToArgvW(GetCommandLineW(),&argc);
    if(argc<3)return 1;
    std::wstring mode=argv[1],name=argv[2];
    if(name.rfind(L"Local\\ContalKUpdate-",0)!=0||name.size()>100)return 1;
    if(mode==L"--finish") {HANDLE event=OpenEventW(EVENT_MODIFY_STATE,FALSE,name.c_str());if(!event)return 2;SetEvent(event);CloseHandle(event);return 0;}
    if(mode!=L"--wait"||argc!=4)return 1;
    completed=CreateEventW(nullptr,TRUE,FALSE,name.c_str());if(!completed)return 2;
    GdiplusStartupInput input;ULONG_PTR token;GdiplusStartup(&token,&input,nullptr);
    logo=std::make_unique<Image>(argv[3]);started=GetTickCount64();
    titleFont=CreateFontW(-18,0,0,0,FW_SEMIBOLD,FALSE,FALSE,FALSE,DEFAULT_CHARSET,0,0,CLEARTYPE_QUALITY,0,L"Segoe UI");
    detailFont=CreateFontW(-13,0,0,0,FW_NORMAL,FALSE,FALSE,FALSE,DEFAULT_CHARSET,0,0,CLEARTYPE_QUALITY,0,L"Segoe UI");
    WNDCLASSW wc{};wc.lpfnWndProc=WindowProc;wc.hInstance=instance;wc.lpszClassName=L"ContalKUpdateProgress";wc.hCursor=LoadCursor(nullptr,IDC_ARROW);RegisterClassW(&wc);
    HWND window=CreateWindowExW(WS_EX_TOPMOST|WS_EX_TOOLWINDOW,wc.lpszClassName,L"Atualizando o ConTalk",WS_POPUP|WS_VISIBLE,(GetSystemMetrics(SM_CXSCREEN)-400)/2,(GetSystemMetrics(SM_CYSCREEN)-275)/2,400,275,nullptr,nullptr,instance,nullptr);
    if(!window)return 3;
    SetWindowRgn(window,CreateRoundRectRgn(0,0,401,276,12,12),TRUE);SetTimer(window,1,40,nullptr);
    // Ready is reported only after the event and the branded window exist.
    HANDLE output=GetStdHandle(STD_OUTPUT_HANDLE);DWORD written;const char ready[]="ready\n";WriteFile(output,ready,6,&written,nullptr);
    MSG msg;while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}
    logo.reset();GdiplusShutdown(token);DeleteObject(titleFont);DeleteObject(detailFont);CloseHandle(completed);LocalFree(argv);return 0;
}
