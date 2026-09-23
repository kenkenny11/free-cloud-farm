package com.freecloudfarm.node

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.widget.Button
import android.widget.EditText
import android.widget.TextView

class MainActivity : AppCompatActivity() {
    private lateinit var apiUrl: EditText
    private lateinit var nodeId: EditText
    private lateinit var nodeName: EditText
    private lateinit var token: EditText
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        apiUrl = findViewById(R.id.apiUrl)
        nodeId = findViewById(R.id.nodeId)
        nodeName = findViewById(R.id.nodeName)
        token = findViewById(R.id.token)
        statusText = findViewById(R.id.statusText)

        val prefs = getSharedPreferences("node", MODE_PRIVATE)
        apiUrl.setText(prefs.getString("apiUrl", "https://free-cloud-farm.onrender.com"))
        nodeId.setText(prefs.getString("nodeId", "android-01"))
        nodeName.setText(prefs.getString("nodeName", "My Android 1"))
        token.setText(prefs.getString("token", ""))

        findViewById<Button>(R.id.startButton).setOnClickListener {
            saveAndStart()
        }

        findViewById<Button>(R.id.stopButton).setOnClickListener {
            stopService(Intent(this, NodeService::class.java))
            statusText.text = "Stopped"
        }

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 100)
        }
    }

    private fun saveAndStart() {
        val prefs = getSharedPreferences("node", MODE_PRIVATE)
        prefs.edit()
            .putString("apiUrl", apiUrl.text.toString().trim().removeSuffix("/"))
            .putString("nodeId", nodeId.text.toString().trim())
            .putString("nodeName", nodeName.text.toString().trim())
            .putString("token", token.text.toString())
            .apply()

        val intent = Intent(this, NodeService::class.java)
        ContextCompat.startForegroundService(this, intent)
        statusText.text = "Starting..."
    }
}
