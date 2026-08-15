<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8">
        <div class="text-center mb-10">
          <v-avatar class="mb-4" color="primary" size="88">
            <v-icon color="white" size="48">mdi-silverware-fork-knife</v-icon>
          </v-avatar>
          <h1 class="text-h4 font-weight-bold">{{ $t("app.name") }}</h1>
          <p class="text-body-1 text-medium-emphasis mt-2">
            {{ $t("welcome.tagline") }}
          </p>
        </div>

        <v-btn
          block
          color="primary"
          size="large"
          @click="$router.push('/register')"
        >
          {{ $t("welcome.createAccount") }}
        </v-btn>

        <v-btn
          block
          class="mt-3"
          color="primary"
          size="large"
          variant="outlined"
          @click="$router.push('/sign-in')"
        >
          {{ $t("welcome.haveAccount") }}
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>
