package com.mygirl.agent

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent

class MyGirlAccessibilityService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent?) { /* No screen scraping. */ }
    override fun onInterrupt() {}
    override fun onServiceConnected() { instance = this }
    override fun onDestroy() { if (instance === this) instance = null; super.onDestroy() }

    fun performSafeNavigation(action: String): Boolean = when (action) {
        "BACK" -> performGlobalAction(GLOBAL_ACTION_BACK)
        "HOME" -> performGlobalAction(GLOBAL_ACTION_HOME)
        else -> false
    }
    companion object {
        @Volatile var instance: MyGirlAccessibilityService? = null
    }
}
