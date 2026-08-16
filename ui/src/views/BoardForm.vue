<template>
  <v-container class="fill-height bg-grey-lighten-4" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" md="6" sm="9">
        <v-card v-if="notFound" class="rounded-lg pa-8 text-center" elevation="2">
          <v-icon color="grey" size="56">mdi-file-question-outline</v-icon>
          <div class="text-h6 mt-4">This form isn't available</div>
        </v-card>

        <v-card v-else-if="submitted" class="rounded-lg pa-8 text-center" elevation="2">
          <v-icon color="success" size="56">mdi-check-circle</v-icon>
          <div class="text-h6 mt-4">Thank you</div>
          <div class="text-body-2 text-grey mt-1">Your submission has been received.</div>
        </v-card>

        <v-card v-else-if="form" class="rounded-lg" elevation="2">
          <v-card-text class="pa-6">
            <div class="d-flex align-center mb-4">
              <v-avatar class="mr-3" color="primary" size="44">
                <v-icon color="white">mdi-clipboard-text</v-icon>
              </v-avatar>
              <div>
                <div class="text-h6 font-weight-bold">{{ form.title }}</div>
                <div v-if="form.description" class="text-body-2 text-grey">
                  {{ form.description }}
                </div>
              </div>
            </div>

            <v-text-field v-model="name" density="comfortable" label="Your name" variant="outlined" />
            <v-text-field
              v-model="email"
              density="comfortable"
              label="Your email (optional)"
              variant="outlined"
            />

            <template v-for="field in form.fields" :key="field.key">
              <v-textarea
                v-if="field.type === 'TEXTAREA'"
                v-model="values[field.key]"
                density="comfortable"
                :label="field.label"
                :required="field.required"
                rows="3"
                variant="outlined"
              />
              <v-select
                v-else-if="field.type === 'SELECT'"
                v-model="values[field.key]"
                density="comfortable"
                :items="field.options || []"
                :label="field.label"
                :required="field.required"
                variant="outlined"
              />
              <v-text-field
                v-else
                v-model="values[field.key]"
                density="comfortable"
                :label="field.label"
                :required="field.required"
                :type="field.type === 'EMAIL' ? 'email' : 'text'"
                variant="outlined"
              />
            </template>

            <v-alert v-if="error" class="mb-4" density="compact" type="error" variant="tonal">
              {{ error }}
            </v-alert>

            <v-btn block color="primary" :loading="submitting" size="large" @click="submit">
              Submit
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
  import { onMounted, reactive, ref } from "vue";
  import { useRoute } from "vue-router";

  const route = useRoute();
  const form = ref(null);
  const notFound = ref(false);
  const submitted = ref(false);
  const submitting = ref(false);
  const error = ref("");
  const name = ref("");
  const email = ref("");
  const values = reactive({});

  async function load() {
    const slug = route.query.slug;
    if (!slug) {
      notFound.value = true;
      return;
    }
    const res = await fetch(`/boardForms/${slug}`);
    if (!res.ok) {
      notFound.value = true;
      return;
    }
    form.value = await res.json();
  }

  async function submit() {
    error.value = "";
    if (!name.value.trim()) {
      error.value = "Your name is required";
      return;
    }
    submitting.value = true;
    try {
      const res = await fetch(`/boardForms/${route.query.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.value, email: email.value, values }),
      });
      const data = await res.json();
      if (!res.ok) {
        error.value = data.error || "Failed to submit";
        return;
      }
      submitted.value = true;
    } catch {
      error.value = "Failed to submit";
    } finally {
      submitting.value = false;
    }
  }

  onMounted(load);
</script>
