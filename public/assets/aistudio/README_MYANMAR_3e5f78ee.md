# My Girl V2 — Android Personal Agent (Starter Project)

ဒီ ZIP သည် Android + FastAPI ကို တကယ် build/run လုပ်နိုင်ရန် ရည်ရွယ်ထားသော starter project ဖြစ်သည်။ Voice wake phrase, Accessibility, background service နှင့် automation အတွက် Android permission/OS constraints ပါဝင်သည်။ App တစ်ခုတည်းက ဖုန်းအားလုံးကို အလိုအလျောက်ထိန်းချုပ်နိုင်မည်မဟုတ်ပါ။

## လုပ်ဆောင်နိုင်သောအရာများ
- Burmese/English AI chat (OpenAI-compatible API)
- Android SpeechRecognizer ဖြင့် voice input နှင့် Android TTS ဖြင့် အသံပြန်ဖြေခြင်း
- Foreground microphone service နမူနာ (notification အမြဲပြမည်)
- "my girl" phrase ကို speech result ထဲတွင်တွေ့လျှင် wake event ထုတ်ပေးခြင်း (beta; continuous listening သည် OEM/Android အလိုက် ရပ်သွားနိုင်သည်)
- User ကိုယ်တိုင် Settings မှ enable လုပ်ရသော Accessibility Service
- Whitelisted app launch + Back/Home action (user-triggered only)
- Task scheduler API နှင့် periodic WorkManager check
- SQLite memory/tasks, explicit approval gate

## မလုပ်နိုင်သေး / လိုအပ်ချက်
- "my girl" အတွက် production-grade offline hotword model မပါ။ Reliable always-on wake-word အတွက် Picovoice Porcupine (commercial terms/API key) သို့မဟုတ် ကိုယ်ပိုင် TensorFlow Lite keyword model ထည့်ရန်လိုသည်။
- Background microphone အတွက် Android 13+ notification permission, Android 14+ microphone foreground service restrictions, battery optimization/OEM restrictions ရှိသည်။ Android က force-stop လုပ်ထားချိန်၊ reboot မပြီးမီ၊ permission မရှိချိန်တွင် မနားထောင်နိုင်။
- Voice language `my-MM` support သည် device Speech Services ပေါ်မူတည်သည်။ TTS Burmese voice မရှိလျှင် fallback voice မပြောနိုင်နိုင်သည်။
- Accessibility Service ကို user Settings ထဲက ကိုယ်တိုင်ဖွင့်ရမည်။ App သည် password, payment, security dialogs ကို bypass မလုပ်ပါ။ arbitrary taps/clicks မလုပ်ပါ။
- Gmail/Calendar/Web search/YouTube adapters မချိတ်ထားသေး။ API contracts/extension points ထည့်ထားသည်။
- Auto execution သည် safe task scheduling သာဖြစ်ပြီး external side effects အတွက် explicit approval လိုသည်။

## Backend setup (Python 3.11+)
```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# .env ထဲ LLM_API_KEY ထည့်ပါ
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Health: `http://127.0.0.1:8000/health`
Swagger: `http://127.0.0.1:8000/docs`

## Android Studio
1. Android Studio (JDK 17 ပါ), Android SDK 35 ဖြင့် `android/` ကို Open လုပ်ပါ။
2. Gradle Sync > Run.
3. Emulator: base URL `http://10.0.2.2:8000/`
4. Physical phone: `android/app/build.gradle.kts` ထဲ API_BASE_URL ကို PC LAN IP (ဥပမာ `http://192.168.1.20:8000/`) ပြောင်းပါ။
5. Phone/PC Wi-Fi တူညီရမည်။ PC firewall port 8000 ခွင့်ပြုပါ။
6. App ထဲက Enable Wake Listener ကိုနှိပ်ပြီး microphone permission ပေးပါ။ Android notification permission တောင်းလျှင် Allow.
7. Accessibility ကို Settings > Accessibility > Downloaded apps > My Girl Agent > On မှ ကိုယ်တိုင်ဖွင့်ပါ။

## APK
Android Studio > Build > Build Bundle(s) / APK(s) > Build APK(s)
`android/app/build/outputs/apk/debug/app-debug.apk`
Release: Build > Generate Signed Bundle / APK. Release မတင်မီ HTTPS, auth, privacy policy, signing key, security audit မဖြစ်မနေပြင်ဆင်ပါ။

## Security
- API key ကို Android app ထဲ မထည့်ပါနှင့်။ Backend `.env` ထဲသာထားပါ။
- `ALLOW_ORIGINS=*` သည် local dev အတွက်သာ။ Public deploy တွင် CORS, JWT auth, TLS, rate limit, user-specific authorization ထည့်ပါ။
- `/api/actions/execute` သည် approved=false ဖြစ်လျှင် reject လုပ်သည်။ လက်ရှိ adapter မရှိသော external action ကို execute မလုပ်ပါ။
