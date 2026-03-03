package expo.modules.batteryoptimization

import android.content.Context
import android.os.PowerManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BatteryOptimizationModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("BatteryOptimization")

        Function("isIgnoringBatteryOptimizations") {
            val context = requireNotNull(appContext.reactContext)
            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            return@Function pm.isIgnoringBatteryOptimizations(context.packageName)
        }
    }
}
