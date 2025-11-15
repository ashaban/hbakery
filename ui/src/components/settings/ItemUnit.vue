<template>
  <v-container fluid>
    <v-dialog
      v-model="addDialog"
      transition="dialog-top-transition"
      width="600"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg flex-wrap px-4" color="primary" flat>
          <div class="d-flex align-center flex-wrap">
            <v-icon class="mr-2 text-white">mdi-map</v-icon>
            <span class="text-white font-weight-bold text-h6">Add Unit</span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="addDialog = false" />
        </v-toolbar>
        <v-card-text class="pt-6">
          <v-form @submit.prevent>
            <v-text-field
              v-model="state.name"
              bg-color="#BDBDBD"
              :error-messages="v$.name.$errors.map((e) => e.$message)"
              label="Unit Name"
              required
              @blur="v$.name.$touch"
              @input="v$.name.$touch"
            />
            <v-text-field
              v-model="state.shortname"
              bg-color="#BDBDBD"
              :error-messages="v$.shortname.$errors.map((e) => e.$message)"
              label="Short Name"
              required
              @blur="v$.shortname.$touch"
              @input="v$.shortname.$touch"
            />
          </v-form>
        </v-card-text>
        <div class="d-flex justify-end">
          <v-btn
            color="success"
            :disabled="v$.$error"
            :loading="loading"
            size="large"
            type="submit"
            variant="elevated"
            @click="create"
          >
            <v-icon start>mdi-plus</v-icon>
            Add
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="editDialog"
      transition="dialog-top-transition"
      width="400"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg flex-wrap px-4" color="primary" flat>
          <div class="d-flex align-center flex-wrap">
            <v-icon class="mr-2 text-white">mdi-map</v-icon>
            <span class="text-white font-weight-bold text-h6">Edit Unit</span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="editDialog = false" />
        </v-toolbar>
        <v-card-text class="pt-6">
          <v-form @submit.prevent>
            <br />
            <v-text-field
              v-model="editingItem.id"
              bg-color="#BDBDBD"
              label="ID"
              readonly
            />
            <v-text-field
              v-model="state.name"
              bg-color="#BDBDBD"
              clearable
              :error-messages="v$.name.$errors.map((e) => e.$message)"
              label="Unit"
              :readonly="loading"
              required
              @blur="v$.name.$touch"
              @input="v$.name.$touch"
            />
            <v-text-field
              v-model="state.shortname"
              bg-color="#BDBDBD"
              :error-messages="v$.shortname.$errors.map((e) => e.$message)"
              label="Short Name"
              required
              @blur="v$.shortname.$touch"
              @input="v$.shortname.$touch"
            />
          </v-form>
        </v-card-text>
        <v-card-actions class="d-flex justify-end justify-space-between">
          <v-btn
            color="success"
            :disabled="v$.$error"
            :loading="loading"
            size="large"
            type="submit"
            variant="elevated"
            @click="saveEdit"
          >
            <v-icon start>mdi-plus</v-icon>
            Save
          </v-btn>
          <v-btn
            color="black"
            :disabled="v$.$error"
            :loading="loading"
            size="large"
            type="submit"
            variant="elevated"
            @click="editDialog = false"
          >
            <v-icon start>mdi-cancel</v-icon>
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :disabled="v$.$error"
            :loading="loading"
            size="large"
            type="submit"
            variant="elevated"
            @click="confirmDeleteDialog = true"
          >
            <v-icon start>mdi-delete</v-icon>
            Delete
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-dialog v-model="confirmDeleteDialog" persistent width="auto">
      <v-card>
        <v-toolbar color="warning" :title="'Confirm Deleteting ' + state.name">
          <v-btn
            color="white"
            icon="mdi-close"
            @click="confirmDeleteDialog = false"
          />
        </v-toolbar>
        <v-card-text
          >Are you sure you want to delete {{ state.name }}?</v-card-text
        >
        <div class="d-flex justify-end justify-space-between">
          <v-btn color="success" @click="confirmDeleteDialog = false"
            >Cancel</v-btn
          >
          <v-btn color="error" @click="remove">Proceed</v-btn>
        </div>
      </v-card>
    </v-dialog>
    <div class="d-flex justify-space-between mb-6">
      Unit
      <v-btn class="text-black justify-end" size="small" @click="csvExport">
        <v-icon color="green" start>mdi-download</v-icon> Download
      </v-btn>
      <v-btn
        v-if="$store.getters.hasTask('can_add_settings')"
        class="text-white justify-end"
        color="#1A237E"
        size="small"
        @click="activateAddDialog"
        ><v-icon>mdi-plus</v-icon> Add New</v-btn
      >
    </div>
    <v-progress-linear :active="loading" :indeterminate="loading" />
    <v-data-table
      class="elevation-1"
      dense
      :headers="headers"
      height="300"
      :items="values"
      :loading="loading"
    >
      <template
        v-if="$store.getters.hasTask('can_add_settings')"
        #item.edit="{ item }"
      >
        <v-icon color="#3F51B5" @click="activateEditDialog(item)"
          >mdi-square-edit-outline</v-icon
        >
      </template>
    </v-data-table>
  </v-container>
</template>
<script>
import { onMounted, reactive, ref } from "vue";
import { useStore } from "vuex";
import { useVuelidate } from "@vuelidate/core";
import { required } from "@vuelidate/validators";

export default {
  setup() {
    const store = useStore();
    const loading = ref(false);
    const values = ref([]);
    const editingItem = ref({});
    const headers = ref([
      {
        title: "ID",
        key: "id",
      },
      {
        title: "Name",
        key: "name",
      },
      {
        title: "Short Name",
        key: "shortname",
      },
      {
        title: "Edit",
        key: "edit",
      },
    ]);
    const addDialog = ref(false);
    const editDialog = ref(false);
    const confirmDeleteDialog = ref(false);
    const form = ref(false);
    const state = reactive({
      name: "",
      shortname: "",
    });
    const rules = {
      name: { required },
      shortname: { required },
    };
    const v$ = useVuelidate(rules, state);
    function loadValues() {
      loading.value = true;
      fetch("/units")
        .then((response) => {
          response
            .json()
            .then((results) => {
              loading.value = false;
              values.value = results;
              results;
            })
            .catch(() => {
              loading.value = false;
            });
        })
        .catch(() => {
          loading.value = false;
        });
    }

    function activateAddDialog() {
      v$.value.name.$touch();
      addDialog.value = true;
      state.name = "";
    }

    function activateEditDialog(item) {
      editingItem.value = JSON.parse(JSON.stringify(item));
      editDialog.value = true;
      state.name = item.name;
      state.shortname = item.shortname;
    }

    async function create() {
      v$.value.$touch();
      const valid = await v$.value.$validate();
      if (!valid) {
        return;
      }
      loading.value = true;
      addDialog.value = false;
      const formData = new FormData();
      formData.append("name", state.name);
      formData.append("shortname", state.shortname);
      fetch("/units", {
        body: formData,
        method: "POST",
      })
        .then((response) => {
          loading.value = false;

          if (response.status !== 200 && response.status !== 201) {
            response.json().then((resp) => {
              store.commit("setMessage", {
                type: "error",
                text: "Failed to save Unit! " + resp.error,
                timeout: 2000,
              });
              return;
            });
          } else {
            response.json().then(() => {
              loadValues();
              store.commit("setMessage", {
                type: "primary",
                text: "Unit saved successfully!",
                timeout: 2000,
              });
            });
          }
        })
        .catch((error) => {
          loading.value = false;
          store.commit("setMessage", {
            type: "error",
            text: "Failed to save Unit!",
            timeout: 2000,
          });
          console.error("Error:", error);
        });
    }

    async function saveEdit() {
      v$.value.$touch();
      const valid = await v$.value.$validate();
      if (!valid) {
        return;
      }
      loading.value = true;
      const formData = new FormData();
      formData.append("name", state.name);
      formData.append("shortname", state.shortname);
      fetch("/units/" + editingItem.value.id, {
        body: formData,
        method: "PUT",
      })
        .then((response) => {
          loading.value = false;
          editDialog.value = false;
          if (response.status !== 200 && response.status !== 201) {
            response.json().then((resp) => {
              store.commit("setMessage", {
                type: "error",
                text: "Failed to edit Unit! " + resp.error,
                timeout: 2000,
              });
              return;
            });
          } else {
            response.json().then(() => {
              loadValues();
              store.commit("setMessage", {
                type: "primary",
                text: "Unit edited successfully!",
                timeout: 2000,
              });
            });
          }
        })
        .catch((error) => {
          loading.value = false;
          store.commit("setMessage", {
            type: "error",
            text: "Failed to edit Unit!",
            timeout: 2000,
          });
          console.error("Error:", error);
        });
    }

    function remove() {
      loading.value = true;
      const formData = new FormData();
      confirmDeleteDialog.value = false;
      fetch("/units/" + editingItem.value.id, {
        body: formData,
        method: "DELETE",
      })
        .then((response) => {
          loading.value = false;
          editDialog.value = false;
          if (response.status !== 200 && response.status !== 201) {
            response.json().then((resp) => {
              store.commit("setMessage", {
                type: "error",
                text: "Failed to delete Unit! " + resp.error,
                timeout: 2000,
              });
              return;
            });
          } else {
            response.json().then(() => {
              loadValues();
              store.commit("setMessage", {
                type: "primary",
                text: "Unit delete successfully!",
                timeout: 2000,
              });
            });
          }
        })
        .catch((error) => {
          loading.value = false;
          store.commit("setMessage", {
            type: "error",
            text: "Failed to delete Unit!",
            timeout: 2000,
          });
          console.error("Error:", error);
        });
    }

    function csvExport() {
      fetch("/units?response=csv")
        .then((response) => {
          response.text().then((csv) => {
            const extension = "csv";
            const encoding = "data:text/csv;charset=utf-8,";
            const csvData = encoding + escape(csv);
            const link = document.createElement("a");
            link.setAttribute("href", csvData);
            link.setAttribute("download", `Unit.${extension}`);
            link.click();
          });
        })
        .catch(() => {
          loading.value = false;
        });
    }

    onMounted(() => {
      loadValues();
    });

    return {
      loading,
      values,
      headers,
      addDialog,
      editDialog,
      form,
      state,
      v$,
      editingItem,
      confirmDeleteDialog,
      csvExport,
      loadValues,
      activateAddDialog,
      activateEditDialog,
      create,
      saveEdit,
      remove,
    };
  },
};
</script>
