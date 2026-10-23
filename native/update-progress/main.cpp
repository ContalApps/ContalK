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
        HBRUSH background=CreateSolidBrush(RGB(17,14,25));FillRect(buffer,&area,background);DeleteObject(background);
        if(logo){Graphics graphics(buffer);graphics.SetInterpolationMode(InterpolationModeHighQualityBicubic);graphics.DrawImage(logo.get(),155,25,90,90);}
        Text(buffer,failed?L"A atualiza\u00e7\u00e3o est\u00e1 demorando":L"Instalando atualiza\u00e7\u00e3o...",{15,133,385,167},titleFont,RGB(240,228,255));
        Text(buffer,failed?L"Abra o ConTALK para verificar. Clique aqui para fechar.":L"O ConTALK ser\u00e1 reaberto automaticamente.",{30,176,370,217},detailFont,RGB(170,153,190));
        HBRUSH track=CreateSolidBrush(RGB(46,34,64));RECT bar{40,232,360,239};FillRect(buffer,&bar,track);DeleteObject(track);
        if(!failed){int offset=int((GetTickCount64()-started)%1600)*240/1600;RECT segment{40+offset,232,120+offset,239};HBRUSH purple=CreateSolidBrush(RGB(158,91,245));FillRect(buffer,&segment,purple);DeleteObject(purple);}
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
    HWND window=CreateWindowExW(WS_EX_TOPMOST|WS_EX_TOOLWINDOW,wc.lpszClassName,L"Atualizando ConTALK",WS_POPUP|WS_VISIBLE,(GetSystemMetrics(SM_CXSCREEN)-400)/2,(GetSystemMetrics(SM_CYSCREEN)-275)/2,400,275,nullptr,nullptr,instance,nullptr);
    if(!window)return 3;
    SetWindowRgn(window,CreateRoundRectRgn(0,0,401,276,20,20),TRUE);SetTimer(window,1,40,nullptr);
    // Ready is reported only after the event and the branded window exist.
    HANDLE output=GetStdHandle(STD_OUTPUT_HANDLE);DWORD written;const char ready[]="ready\n";WriteFile(output,ready,6,&written,nullptr);
    MSG msg;while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}
    logo.reset();GdiplusShutdown(token);DeleteObject(titleFont);DeleteObject(detailFont);CloseHandle(completed);LocalFree(argv);return 0;
}
