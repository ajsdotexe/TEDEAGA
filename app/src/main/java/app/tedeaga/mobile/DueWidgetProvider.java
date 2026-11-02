package app.tedeaga.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class DueWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        updateAll(context, manager, ids);
    }

    static void updateAll(Context context, AppWidgetManager manager, int[] ids) {
        String text = context.getSharedPreferences("tedeaga_widget", 0)
            .getString("due_text", "Nenhuma conta pendente.");
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.due_widget);
            views.setTextViewText(R.id.due_summary, text);
            Intent launch = new Intent(context, MainActivity.class);
            PendingIntent pending = PendingIntent.getActivity(context, 0, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.due_widget_root, pending);
            manager.updateAppWidget(id, views);
        }
    }
}
