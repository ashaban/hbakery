import "@mdi/font/css/materialdesignicons.css";
import "vuetify/styles";

import { createVuetify } from "vuetify";

// Same primary blue as the staff system, so the two apps read as one
// product to anyone who sees both.
export default createVuetify({
  theme: {
    defaultTheme: "light",
    themes: {
      light: {
        colors: {
          primary: "#1867C0",
          secondary: "#5CBBF6",
          surface: "#FFFFFF",
          background: "#F5F5F5",
        },
      },
    },
  },
  defaults: {
    VTextField: { variant: "outlined", density: "comfortable" },
    VSelect: { variant: "outlined", density: "comfortable" },
    VBtn: { variant: "flat" },
  },
});
