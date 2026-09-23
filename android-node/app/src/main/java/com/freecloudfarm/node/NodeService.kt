package com.freecloudfarm.node

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class NodeService : Service() {
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO)
    private var running=true
    private val channelId="freecloudfarm_node"

    override fun onCreate(){super.onCreate();createChannel();startForeground(7,notification("Connecting to FreeCloudFarm"));scope.launch{runNodeLoop()}}

    private suspend fun runNodeLoop(){
        val prefs=getSharedPreferences("node",MODE_PRIVATE)
        val api=prefs.getString("apiUrl","")?.trimEnd('/')?:""
        val nodeId=prefs.getString("nodeId","")?:""
        val nodeName=prefs.getString("nodeName","Android Node")?:"Android Node"
        val token=prefs.getString("token","")?:""
        if(api.isBlank()||nodeId.isBlank()||token.isBlank()){updateNotification("Configuration required");stopSelf();return}
        var registered=prefs.getBoolean("registered",false)
        while(running){
            val battery=batteryPercent()
            val payload=JSONObject().put("nodeId",nodeId).put("name",nodeName).put("platform","android").put("deviceModel",Build.MANUFACTURER+" "+Build.MODEL).put("androidVersion",Build.VERSION.RELEASE).put("appVersion","1.1.0").put("battery",battery)
            val path=if(registered)"/api/node/heartbeat" else "/api/node/register"
            val ok=post(api+path,token,payload.toString())
            if(ok){registered=true;prefs.edit().putBoolean("registered",true).apply();updateNotification("Online • Battery $battery%");pollTasks(api,nodeId,token)}
            else updateNotification("Waiting for server")
            delay(20_000)
        }
    }

    private suspend fun pollTasks(api:String,nodeId:String,token:String){
        try{
            val response=get(api+"/api/tasks/poll?nodeId="+java.net.URLEncoder.encode(nodeId,"UTF-8"),token)
            if(response.isBlank())return
            val arr=JSONObject(response).optJSONArray("tasks")?:JSONArray()
            for(i in 0 until arr.length()) executeTask(api,token,arr.getJSONObject(i))
        }catch(_:Exception){ }
    }

    private suspend fun executeTask(api:String,token:String,task:JSONObject){
        val id=task.optString("id")
        val action=task.optString("action")
        val target=task.optString("target")
        try{
            withContext(Dispatchers.Main){
                when(action){
                    "Open browser URL"->openBrowser(target)
                    "Open social app"->openSocialApp(target)
                    "Pause task"->delay(1000)
                    else->throw IllegalArgumentException("Unsupported action: $action")
                }
            }
            post(api+"/api/tasks/"+java.net.URLEncoder.encode(id,"UTF-8"),token,JSONObject().put("status","completed").put("result",JSONObject().put("message","Task executed on Android")).toString())
        }catch(e:Exception){
            post(api+"/api/tasks/"+java.net.URLEncoder.encode(id,"UTF-8"),token,JSONObject().put("status","failed").put("result",JSONObject().put("message",e.message?:"Execution failed")).toString())
        }
    }

    private fun openBrowser(target:String){
        if(target.isBlank()||!target.startsWith("http://")&&!target.startsWith("https://"))throw IllegalArgumentException("A valid http/https URL is required")
        val intent=Intent(Intent.ACTION_VIEW,Uri.parse(target)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)
    }

    private fun openSocialApp(target:String){
        val packageName=when(target.lowercase()){
            "facebook","fb"->"com.facebook.katana"
            "instagram","ig"->"com.instagram.android"
            "youtube","yt"->"com.google.android.youtube"
            "tiktok"->"com.zhiliaoapp.musically"
            "x","twitter"->"com.twitter.android"
            else->throw IllegalArgumentException("Use target: Facebook, Instagram, YouTube, TikTok, or X")
        }
        val launch=packageManager.getLaunchIntentForPackage(packageName)?:throw IllegalArgumentException("App is not installed")
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);startActivity(launch)
    }

    private fun get(urlString:String,token:String):String=try{val c=URL(urlString).openConnection() as HttpURLConnection;c.requestMethod="GET";c.connectTimeout=15000;c.readTimeout=15000;c.setRequestProperty("X-Node-Token",token);val code=c.responseCode;val text=(if(code in 200..299)c.inputStream else c.errorStream)?.bufferedReader()?.use{it.readText()}?"";c.disconnect();if(code in 200..299)text else ""}catch(_:Exception){""}
    private fun post(urlString:String,token:String,body:String):Boolean=try{val c=URL(urlString).openConnection() as HttpURLConnection;c.requestMethod="POST";c.connectTimeout=15000;c.readTimeout=15000;c.doOutput=true;c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("X-Node-Token",token);c.outputStream.use{it.write(body.toByteArray())};val code=c.responseCode;c.disconnect();code in 200..299}catch(_:Exception){false}
    private fun batteryPercent():Int{val manager=getSystemService(BATTERY_SERVICE) as BatteryManager;return manager.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).coerceIn(0,100)}
    private fun createChannel(){if(Build.VERSION.SDK_INT>=26){val channel=NotificationChannel(channelId,"FreeCloudFarm Node",NotificationManager.IMPORTANCE_LOW);getSystemService(NotificationManager::class.java).createNotificationChannel(channel)}}
    private fun notification(text:String):Notification=NotificationCompat.Builder(this,channelId).setContentTitle("FreeCloudFarm Node").setContentText(text).setSmallIcon(android.R.drawable.stat_sys_upload).setOngoing(true).build()
    private fun updateNotification(text:String){getSystemService(NotificationManager::class.java).notify(7,notification(text))}
    override fun onDestroy(){running=false;scope.cancel();super.onDestroy()}
    override fun onBind(intent:Intent?):IBinder?=null
}
