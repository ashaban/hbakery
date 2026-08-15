<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8">
        <div class="text-center mb-10">
          <v-avatar class="mb-4" color="primary" size="88">
            <v-icon color="white" size="48">mdi-silverware-fork-knife</v-icon>
          </v-avatar>
          <h1 class="text-h4 font-weight-bold">Hanein Bakery</h1>
          <p class="text-body-1 text-medium-emphasis mt-2">
            Order fresh bread and pastries for your shop, and we'll tell you
            the day it arrives.
          </p>
        </div>

        <v-btn
          block
          color="primary"
          size="large"
          @click="$router.push('/register')"
        >
          Create an account
        </v-btn>

        <v-btn
          block
          class="mt-3"
          color="primary"
          size="large"
          variant="outlined"
          @click="$router.push('/sign-in')"
        >
          I already have an account
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>
