package app.tedeaga.mobile;

import android.app.Activity;
import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.common.api.Scope;
import java.util.Arrays;

@CapacitorPlugin(name = "GoogleDriveAuth")
public class GoogleDriveAuthPlugin extends Plugin {
    @PluginMethod
    public void authorize(PluginCall call) {
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(Arrays.asList(
                new Scope("openid"), new Scope("email"), new Scope("profile"),
                new Scope("https://www.googleapis.com/auth/drive.appdata")))
            .build();
        Identity.getAuthorizationClient(getActivity()).authorize(request)
            .addOnSuccessListener(result -> completeOrRequestConsent(call, result))
            .addOnFailureListener(error -> call.reject(error.getMessage()));
    }

    private void completeOrRequestConsent(PluginCall call, AuthorizationResult result) {
        if (result.hasResolution()) {
            Intent intent = new Intent(getContext(), GoogleAuthorizationActivity.class);
            intent.putExtra(GoogleAuthorizationActivity.EXTRA_PENDING_INTENT, result.getPendingIntent());
            startActivityForResult(call, intent, "authorizationResult");
            return;
        }
        resolveToken(call, result);
    }

    @com.getcapacitor.annotation.ActivityCallback
    private void authorizationResult(PluginCall call, ActivityResult activityResult) {
        if (call == null) return;
        int resultCode = activityResult.getResultCode();
        Intent data = activityResult.getData();
        if (resultCode != Activity.RESULT_OK || data == null) {
            call.reject("O acesso ao Google foi cancelado.");
            return;
        }
        try {
            AuthorizationResult result = Identity.getAuthorizationClient(getActivity()).getAuthorizationResultFromIntent(data);
            resolveToken(call, result);
        } catch (Exception error) {
            call.reject(error.getMessage());
        }
    }

    @PluginMethod
    public void revoke(PluginCall call) {
        Identity.getAuthorizationClient(getActivity())
            .revokeAccess(RevokeAccessRequest.builder().setScopes(Arrays.asList(
                new Scope("openid"), new Scope("email"), new Scope("profile"),
                new Scope("https://www.googleapis.com/auth/drive.appdata"))).build())
            .addOnSuccessListener(ignored -> call.resolve())
            .addOnFailureListener(error -> call.reject(error.getMessage()));
    }

    private void resolveToken(PluginCall call, AuthorizationResult result) {
        if (call == null) return;
        String token = result.getAccessToken();
        if (token == null || token.isEmpty()) { call.reject("O Google não forneceu um token de acesso."); return; }
        JSObject value = new JSObject();
        value.put("accessToken", token);
        value.put("scopes", result.getGrantedScopes().toString());
        call.resolve(value);
    }
}
