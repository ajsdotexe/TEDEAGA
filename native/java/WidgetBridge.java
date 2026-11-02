package app.tedeaga.mobile;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Permite que o app (JavaScript) peça a atualização dos widgets da tela inicial. */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridge extends Plugin {
    @PluginMethod
    public void refresh(PluginCall call) {
        BaseWidget.refreshAll(getContext());
        call.resolve();
    }
}
