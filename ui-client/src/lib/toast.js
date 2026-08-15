// One shared snackbar, rendered once in App.vue. Screens call
// notify()/notifyError() rather than each carrying their own snackbar.
import { reactive } from "vue";

export const toast = reactive({
  active: false,
  text: "",
  color: "success",
});

export function notify (text, color = "success") {
  toast.text = text;
  toast.color = color;
  toast.active = true;
}

export function notifyError (error) {
  notify(
    typeof error === "string"
      ? error
      : error?.message || "Something went wrong. Please try again.",
    "error",
  );
}
