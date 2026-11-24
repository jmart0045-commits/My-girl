package com.mygirl.agent

import android.Manifest
import android.content.*
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.Locale

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MyGirlHome() }
    }
}
data class Line(val role:String,val text:String)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyGirlHome() {
    val ctx= LocalContext.current
    val scope= rememberCoroutineScope()
    val chat= remember { mutableStateListOf(Line("assistant","မင်္ဂလာပါ 💗 My Girl ပါ။ “Hey My Girl” လို့ခေါ်နိုင်ပါတယ်။")) }
    var input by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("Ready") }
    var tts by remember { mutableStateOf<TextToSpeech?>(null) }
    val http= remember { OkHttpClient() }
    val permissionLauncher= rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        status=if(result.values.all { it }) "Permissions granted" else "Permission missing"
    }
    val speechResult = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode == android.app.Activity.RESULT_OK) {
            input = result.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull().orEmpty()
        }
    }
    val micLauncher= rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if(ok) {
            val intent=Intent(ctx,WakeWordService::class.java)
            try { if(Build.VERSION.SDK_INT>=26) ctx.startForegroundService(intent) else ctx.startService(intent); status="Wake listener started" }
            catch(e:Exception) { status="Cannot start listener: ${e.message}" }
        } else status="Microphone permission denied"
    }
    val wakeReceiver= remember {
        object: BroadcastReceiver() {
            override fun onReceive(context:Context?, intent:Intent?) {
                status="Wake phrase detected — tap mic and speak"
                tts?.language=Locale("my","MM")
                tts?.speak("ဟုတ်ကဲ့၊ ပြောပါရှင်",TextToSpeech.QUEUE_FLUSH,null,"wake_ack")
            }
        }
    }
    DisposableEffect(Unit) {
        val engine=TextToSpeech(ctx) { }
        tts=engine
        val filter=IntentFilter(WakeWordService.ACTION_WAKE)
        if(Build.VERSION.SDK_INT>=33) ctx.registerReceiver(wakeReceiver,filter,Context.RECEIVER_NOT_EXPORTED)
        else @Suppress("DEPRECATION") ctx.registerReceiver(wakeReceiver,filter)
        onDispose { runCatching { ctx.unregisterReceiver(wakeReceiver) }; engine.shutdown() }
    }
    fun send() {
        val msg=input.trim(); if(msg.isEmpty()||busy) return
        chat.add(Line("user",msg)); input=""; busy=true; status="Thinking…"
        scope.launch {
            try {
                val hist=org.json.JSONArray()
                chat.dropLast(1).takeLast(12).forEach { hist.put(JSONObject().put("role",it.role).put("content",it.text)) }
                val json=JSONObject().put("user_id","default").put("message",msg).put("history",hist)
                val body=json.toString().toRequestBody("application/json".toMediaType())
                val req=Request.Builder().url(BuildConfig.API_BASE_URL+"api/chat").post(body).build()
                val reply=withContext(Dispatchers.IO) {
                    http.newCall(req).execute().use { r ->
                        if(!r.isSuccessful) error("HTTP ${r.code}: ${r.body?.string()}")
                        JSONObject(r.body?.string() ?: "{}").optString("reply","No response")
                    }
                }
                chat.add(Line("assistant",reply))
                tts?.language=Locale("my","MM")
                tts?.speak(reply,TextToSpeech.QUEUE_FLUSH,null,"mygirl_reply")
                status="Ready"
            } catch(e:Exception) { chat.add(Line("assistant","ချိတ်ဆက်မှုအမှား: ${e.message}")); status="Connection error" }
            finally { busy=false }
        }
    }
    MaterialTheme(colorScheme=darkColorScheme(primary=Color(0xFFFF79B8),background=Color(0xFF11101A),surface=Color(0xFF211D2D))) {
        Scaffold(topBar={ TopAppBar(title={ Column { Text("My Girl V2 💗"); Text(status,style=MaterialTheme.typography.labelSmall) } },
            actions={
                TextButton(onClick={ micLauncher.launch(Manifest.permission.RECORD_AUDIO) }) { Text("Wake ON") }
                TextButton(onClick={ ctx.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }) { Text("Accessibility") }
            },colors=TopAppBarDefaults.topAppBarColors(containerColor=Color(0xFF211D2D))) },
            containerColor=Color(0xFF11101A)) { pad ->
            Column(Modifier.fillMaxSize().padding(pad).padding(12.dp)) {
                LazyColumn(Modifier.weight(1f).fillMaxWidth(),verticalArrangement=Arrangement.spacedBy(9.dp)) {
                    items(chat) { line ->
                        Row(Modifier.fillMaxWidth(),horizontalArrangement=if(line.role=="user") Arrangement.End else Arrangement.Start) {
                            Surface(color=if(line.role=="user") Color(0xFF663D5A) else Color(0xFF2B2638),shape=RoundedCornerShape(16.dp),modifier=Modifier.widthIn(max=310.dp)) {
                                Text(line.text,Modifier.padding(13.dp),color=Color.White)
                            }
                        }
                    }
                    if(busy) item { Text("စဉ်းစားနေပါတယ်…",color=Color.LightGray) }
                }
                Row(verticalAlignment=Alignment.CenterVertically) {
                    OutlinedTextField(value=input,onValueChange={input=it},modifier=Modifier.weight(1f),placeholder={Text("My Girl ကို ပြောပါ…")},maxLines=4)
                    IconButton(onClick={
                        if(SpeechRecognizer.isRecognitionAvailable(ctx)) {
                            val i=Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                                putExtra(RecognizerIntent.EXTRA_LANGUAGE,"my-MM")
                            }
                            speechResult.launch(i)
                        } else status="Speech recognition unavailable"
                    }) { Icon(Icons.Default.Mic,contentDescription="Voice input",tint=Color(0xFFFF79B8)) }
                    IconButton(onClick={send()},enabled=!busy) { Icon(Icons.Default.Send,contentDescription="Send",tint=Color(0xFFFF79B8)) }
                }
                Row(horizontalArrangement=Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick={
                        val perms= mutableListOf(Manifest.permission.RECORD_AUDIO)
                        if(Build.VERSION.SDK_INT>=33) perms.add(Manifest.permission.POST_NOTIFICATIONS)
                        permissionLauncher.launch(perms.toTypedArray())
                        micLauncher.launch(Manifest.permission.RECORD_AUDIO)
                    }) { Text("Enable background wake") }
                    OutlinedButton(onClick={
                        ctx.startService(Intent(ctx,WakeWordService::class.java).setAction("STOP"))
                        status="Wake listener stopped"
                    }) { Text("Stop listener") }
                }
                Text("Wake phrase beta: say “my girl”. Continuous listening depends on Android/device speech service.",style=MaterialTheme.typography.labelSmall,color=Color.Gray)
            }
        }
    }
}
