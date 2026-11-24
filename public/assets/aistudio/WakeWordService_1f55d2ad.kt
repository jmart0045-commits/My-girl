package com.mygirl.agent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.app.NotificationCompat

/**
 * Beta wake phrase listener. Uses platform speech recognition, not an offline hotword engine.
 * Android/OEM may stop recognition sessions; use a licensed hotword SDK for production.
 */
class WakeWordService : Service() {
    private var recognizer: SpeechRecognizer? = null
    private var listening = false
    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
            NotificationChannel("mygirl_mic", "My Girl voice listener", NotificationManager.IMPORTANCE_LOW))
        val notification: Notification = NotificationCompat.Builder(this, "mygirl_mic")
            .setContentTitle("My Girl is listening")
            .setContentText("Wake phrase detection is active. Tap Stop in the app to disable.")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now).setOngoing(true).build()
        startForeground(42, notification)
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP") { stopListening(); stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return START_NOT_STICKY }
        startListening()
        return START_STICKY
    }
    private fun startListening() {
        if (listening || !SpeechRecognizer.isRecognitionAvailable(this)) return
        listening = true
        recognizer = SpeechRecognizer.createSpeechRecognizer(this)
        recognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: android.os.Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onError(error: Int) { restart() }
            override fun onResults(results: android.os.Bundle?) {
                val words = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.joinToString(" ")?.lowercase().orEmpty()
                if (words.contains("my girl")) {
                    sendBroadcast(Intent(ACTION_WAKE).setPackage(packageName))
                }
                restart()
            }
            override fun onPartialResults(partialResults: android.os.Bundle?) {
                val words = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.joinToString(" ")?.lowercase().orEmpty()
                if (words.contains("my girl")) sendBroadcast(Intent(ACTION_WAKE).setPackage(packageName))
            }
            override fun onEvent(eventType: Int, params: android.os.Bundle?) {}
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }
        try { recognizer?.startListening(intent) } catch (_: Exception) { listening = false }
    }
    private fun restart() {
        listening = false
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
        if (Build.VERSION.SDK_INT >= 26) android.os.Handler(mainLooper).postDelayed({ startListening() }, 900)
    }
    private fun stopListening() {
        listening = false
        recognizer?.cancel(); recognizer?.destroy(); recognizer = null
    }
    override fun onDestroy() { stopListening(); super.onDestroy() }
    override fun onBind(intent: Intent?): IBinder? = null
    companion object { const val ACTION_WAKE = "com.mygirl.agent.WAKE_DETECTED" }
}
