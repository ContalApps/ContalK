using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Globalization;
using System.Speech.Synthesis;
using System.Collections.Generic;
using System.Web.Script.Serialization;

// Samples only the configured key; never records typing or intercepts input.
internal static class VoiceInput {
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int key);
    [DllImport("kernel32.dll")] private static extern IntPtr GetStdHandle(int handle);
    [DllImport("kernel32.dll", SetLastError=true)] private static extern bool PeekNamedPipe(IntPtr pipe, IntPtr buffer, uint size, IntPtr read, out uint available, IntPtr left);
    private static int Speech(string voice,bool list) {
        try {
            using(var synth=new SpeechSynthesizer()) {
                if(list){
                    var voices=new List<object>();
                    foreach(var item in synth.GetInstalledVoices())if(item.Enabled)voices.Add(new {id=item.VoiceInfo.Name,label=item.VoiceInfo.Name,language=item.VoiceInfo.Culture.Name});
                    Console.OutputEncoding=new UTF8Encoding(false);Console.WriteLine(new JavaScriptSerializer().Serialize(voices));return 0;
                }
                var encoded=Console.ReadLine();if(String.IsNullOrEmpty(encoded)||encoded.Length>16000)return 1;
                var text=new UTF8Encoding(false,true).GetString(Convert.FromBase64String(encoded));if(String.IsNullOrWhiteSpace(text)||text.Length>2500)return 1;
                if(!String.IsNullOrEmpty(voice)&&voice!="default")synth.SelectVoice(voice);
                else {try{synth.SelectVoiceByHints(VoiceGender.NotSet,VoiceAge.NotSet,0,CultureInfo.GetCultureInfo("pt-BR"));}catch{}}
                using(var wave=new MemoryStream())using(var done=new ManualResetEvent(false)) {
                    bool failed=false;synth.SetOutputToWaveStream(wave);
                    synth.SpeakCompleted+=(sender,eventArgs)=>{failed=eventArgs.Error!=null||eventArgs.Cancelled;try{done.Set();}catch(ObjectDisposedException){}};
                    synth.SpeakAsync(text);var clock=Stopwatch.StartNew();
                    while(!done.WaitOne(30)){
                        uint available;
                        if(clock.ElapsedMilliseconds>20000||!PeekNamedPipe(GetStdHandle(-10),IntPtr.Zero,0,IntPtr.Zero,out available,IntPtr.Zero)){synth.SpeakAsyncCancelAll();return 1;}
                    }
                    if(failed||wave.Length>24*1024*1024)return 1;
                    var output=Console.OpenStandardOutput();wave.Position=0;wave.CopyTo(output);output.Flush();return 0;
                }
            }
        }catch{return 1;}
    }
    private static int Main(string[] args) {
        if(args.Length==1&&args[0]=="--voices")return Speech(null,true);
        if(args.Length==2&&args[0]=="--speech")return Speech(args[1],false);
        int key;
        if(args.Length!=2 || args[0]!="--key" || !Int32.TryParse(args[1],out key) || !((key>=0x75 && key<=0x87) || key==0xa3 || key==0x60))return 1;
        try {
            Console.WriteLine("{\"ready\":true}"); Console.Out.Flush();
            bool armed=false,previous=false;long heartbeat=0;var clock=Stopwatch.StartNew();
            while(true){
                uint available;
                if(!PeekNamedPipe(GetStdHandle(-10),IntPtr.Zero,0,IntPtr.Zero,out available,IntPtr.Zero))return 0;
                bool held=(GetAsyncKeyState(key)&0x8000)!=0;
                // Reconnecting or unmuting while held requires release first.
                if(!held)armed=true;
                bool pressed=armed&&held;long now=clock.ElapsedMilliseconds;
                if(pressed!=previous || pressed&&now>=heartbeat){
                    Console.WriteLine(pressed?"{\"pressed\":true}":"{\"pressed\":false}"); Console.Out.Flush();
                    previous=pressed;heartbeat=now+400;
                }
                Thread.Sleep(8);
            }
        }catch{return 1;}
    }
}
