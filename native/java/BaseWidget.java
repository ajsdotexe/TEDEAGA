package app.tedeaga.mobile;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

/** Base dos widgets: lê o texto que o app salvou (Preferences do Capacitor) e mostra na tela inicial. */
public abstract class BaseWidget extends AppWidgetProvider {
    abstract String prefKey();
    abstract String widgetTitle();

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }

    private void update(Context context, AppWidgetManager manager, int id) {
        SharedPreferences p = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String body = p.getString(prefKey(), "");
        if (body == null || body.trim().isEmpty()) body = "Abra o TEDEAGA para carregar os dados.";
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.tedeaga_widget);
        v.setTextViewText(R.id.w_title, widgetTitle());
        v.setTextViewText(R.id.w_body, body);
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        v.setOnClickPendingIntent(R.id.w_root, pi);
        manager.updateAppWidget(id, v);
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        Class<?>[] kinds = new Class<?>[]{AgendaWidget.class, RotinaWidget.class, ContasWidget.class, NutriWidget.class};
        for (Class<?> k : kinds) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, k));
            if (ids.length > 0) {
                Intent i = new Intent(context, k);
                i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                context.sendBroadcast(i);
            }
        }
    }
}
