package app.tedeaga.mobile;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidWidget")
public class AndroidWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String text = call.getString("text", "Nenhuma conta pendente.");
        getContext().getSharedPreferences("tedeaga_widget", 0).edit().putString("due_text", text).apply();
        AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
        int[] ids = manager.getAppWidgetIds(new ComponentName(getContext(), DueWidgetProvider.class));
        DueWidgetProvider.updateAll(getContext(), manager, ids);
        call.resolve();
    }
}
