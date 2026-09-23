package com.freecloudfarm.node

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class NodeService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var running = true
    private val channelId = "freecloudfarm_node"

    override fun onCreate() {
        super.onCreate()
        createChannel()
        startForeground(7, notification("Connecting to FreeCloudFarm"))
        scope.launch { registerAndHeartbeat() }
    }

    private suspend fun registerAndHeartbeat() {
        val prefs = getSharedPreferences("node", MODE_PRIVATE)
        val api = prefs.getString("apiUrl", "")?.trimEnd('/') ?: ""
        val nodeId = prefs.getString("nodeId", "") ?: ""
        val nodeName = prefs.getString("nodeName", "Android Node") ?: "Android Node"
        val token = prefs.getString("token", "") ?: ""

        if (api.isBlank() || nodeId.isBlank() || token.isBlank()) {
            updateNotification("Configuration required")
            stopSelf()
            return
        }

        while (running) {
            val battery = batteryPercent()
            val payload = JSONObject()
                .put("nodeId", nodeId)
                .put("name", nodeName)
                .put("platform", "android")
                .put("deviceModel", Build.MANUFACTURER + " " + Build.MODEL)
                .put("androidVersion", Build.VERSION.RELEASE)
                .put("appVersion", "1.0.0")
                .put("battery", battery)

            val registerPath = if (isRegistered(prefs)) "/api/node/heartbeat" else "/api/node/register"
            val ok = post(api + registerPath, token, payload.toString())

            if (ok) {
                prefs.edit().putBoolean("registered", true).apply()
                updateNotification("Online • Battery $battery%")
            } else {
                updateNotification("Waiting for server")
            }

            delay(20_000)
        }
    }

    private fun isRegistered(prefs: android.content.SharedPreferences): Boolean =
        prefs.getBoolean("registered", false)

    private fun post(urlString: String, token: String, body: String): Boolean {
        return try {
            val connection = URL(urlString).openConnection() as HttpURLConnection
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 15_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("X-Node-Token", token)
            connection.outputStream.use { it.write(body.toByteArray()) }
            val code = connection.responseCode
            connection.disconnect()
            code in 200..299
        } catch (_: Exception) {
            false
        }
    }

    private fun batteryPercent(): Int {
        val manager = getSystemService(BATTERY_SERVICE) as BatteryManager
        return manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).coerceIn(0, 100)
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(channelId, "FreeCloudFarm Node", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun notification(text: String): Notification =
        NotificationCompat.Builder(this, channelId)
            .setContentTitle("FreeCloudFarm Node")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .build()

    private fun updateNotification(text: String) {
        getSystemService(NotificationManager::class.java).notify(7, notification(text))
    }

    override fun onDestroy() {
        running = false
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
