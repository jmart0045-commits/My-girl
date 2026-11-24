package com.mygirl.agent

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/** Periodic background hook. Add authenticated server-side due-task fetching here. */
class TaskWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        // Safe by default: no external action is performed by this worker.
        return Result.success()
    }
}
