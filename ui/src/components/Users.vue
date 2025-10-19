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
            <v-icon class="mr-2 text-white">mdi-account</v-icon>
            <span class="text-white font-weight-bold text-h6">Add User</span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="addDialog = false" />
        </v-toolbar>
        <v-card-text class="pt-6">
          <v-text-field
            v-model="state.name"
            bg-color="#BDBDBD"
            :error-messages="v$.name.$errors.map((e) => e.$message)"
            :label="'fullName'"
            required
            @blur="v$.name.$touch"
            @input="v$.name.$touch"
          />
          <v-text-field
            v-model="state.title"
            bg-color="#BDBDBD"
            label="Title"
          />
          <v-text-field
            v-model="state.email"
            bg-color="#BDBDBD"
            :error-messages="v$.email.$errors.map((e) => e.$message)"
            label="Email"
            required
            @blur="v$.email.$touch"
            @input="v$.email.$touch"
          />
          <v-text-field
            v-model="state.phone"
            bg-color="#BDBDBD"
            :error-messages="v$.phone.$errors.map((e) => e.$message)"
            label="Phone Number"
            required
            @blur="v$.phone.$touch"
            @input="v$.phone.$touch"
          />
          <v-autocomplete
            v-model="state.role"
            bg-color="#BDBDBD"
            :error-messages="v$.role.$errors.map((e) => e.$message)"
            item-title="name"
            item-value="id"
            :items="roles"
            label="Role"
            required
            @blur="v$.role.$touch"
            @change="v$.role.$touch"
          />
          <v-text-field
            v-model="state.password"
            :append-icon="password_show ? 'mdi-eye' : 'mdi-eye-off'"
            bg-color="#BDBDBD"
            :error-messages="v$.password.$errors.map((e) => e.$message)"
            label="Password"
            required
            :type="password_show ? 'text' : 'password'"
            @blur="v$.password.$touch"
            @click:append="password_show = !password_show"
            @input="v$.password.$touch"
          />
        </v-card-text>
        <div class="d-flex justify-end">
          <v-btn
            color="success"
            :disabled="v$.$error"
            :loading="loading"
            size="small"
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
      width="auto"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg flex-wrap px-4" color="primary" flat>
          <div class="d-flex align-center flex-wrap">
            <v-icon class="mr-2 text-white">mdi-account</v-icon>
            <span class="text-white font-weight-bold text-h6">Edit User</span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="editDialog = false" />
        </v-toolbar>
        <v-card-text class="pt-6">
          <v-text-field
            v-model="editingItem.id"
            bg-color="#BDBDBD"
            disabled
            label="ID"
          />
          <v-text-field
            v-model="state.email"
            bg-color="#BDBDBD"
            density="compact"
            disabled
            :error-messages="v$.email.$errors.map((e) => e.$message)"
            label="Email"
            required
            @blur="v$.email.$touch"
            @input="v$.email.$touch"
          />
          <v-text-field
            v-model="state.name"
            bg-color="#BDBDBD"
            :error-messages="v$.name.$errors.map((e) => e.$message)"
            label="Full Name"
            required
            @blur="v$.name.$touch"
            @input="v$.name.$touch"
          />
          <v-text-field
            v-model="state.title"
            bg-color="#BDBDBD"
            label="Title"
          />
          <v-text-field
            v-model="state.phone"
            bg-color="#BDBDBD"
            :error-messages="v$.phone.$errors.map((e) => e.$message)"
            label="Phone Number"
            required
            @blur="v$.phone.$touch"
            @input="v$.phone.$touch"
          />
          <v-autocomplete
            v-model="state.role"
            bg-color="#BDBDBD"
            :error-messages="v$.role.$errors.map((e) => e.$message)"
            item-title="name"
            item-value="id"
            :items="roles"
            label="Role"
            required
            @blur="v$.role.$touch"
            @change="v$.role.$touch"
          />
          <v-text-field
            v-model="state.password"
            bg-color="#BDBDBD"
            label="Password"
            :type="password_show ? 'text' : 'password'"
          />
        </v-card-text>
        <div class="d-flex justify-end justify-space-between">
          <v-btn
            color="success"
            :disabled="v$.$error"
            :loading="loading"
            size="large"
            type="submit"
            variant="elevated"
            @click="saveEdit"
          >
            <v-icon start>mdi-pencil</v-icon>
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
        </div>
      </v-card>
    </v-dialog>
    <v-dialog v-model="confirmDeleteDialog" persistent width="auto">
      <v-card>
        <v-toolbar
          color="warning"
          title="Confirm Deleting User: {{state.name }}"
        >
          <v-btn
            color="white"
            icon="mdi-close"
            @click="confirmDeleteDialog = false"
          />
        </v-toolbar>
        <v-card-text>Confirm Delete User: {{ state.name }}</v-card-text>
        <div class="d-flex justify-end justify-space-between">
          <v-btn color="success" @click="confirmDeleteDialog = false"
            >Cancel</v-btn
          >
          <v-btn color="error" @click="remove">Proceed</v-btn>
        </div>
      </v-card>
    </v-dialog>
    <v-toolbar class="rounded-lg mb-2 px-4" color="primary" flat height="60">
      <v-toolbar-title class="text-white font-weight-bold text-h6">
        <v-icon class="mr-2" color="white">mdi-account</v-icon>
        Users
      </v-toolbar-title>
      <v-spacer />
      <v-btn
        class="text-white font-weight-medium"
        color="#1A237E"
        size="small"
        @click="activateAddDialog"
      >
        <v-icon start>mdi-plus</v-icon>
        Add User
      </v-btn>
    </v-toolbar>
    <v-card class="rounded-lg">
      <v-card-text>
        <v-progress-linear
          :active="loadingValues"
          :indeterminate="loadingValues"
        />
        <v-data-table
          class="elevation-1"
          dense
          :headers="headers"
          height="300"
          :items="values"
        >
          <template #item.edit="{ item }">
            <v-icon color="#3F51B5" @click="activateEditDialog(item)"
              >mdi-square-edit-outline</v-icon
            >
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>
<script>
import { onMounted, reactive, ref } from "vue";
import { useStore } from "vuex";
import { useVuelidate } from "@vuelidate/core";
import { email, required } from "@vuelidate/validators";

export default {
  setup() {
    const store = useStore();
    const loading = ref(false);
    const loadingValues = ref(false);
    const password_show = ref(false);
    const values = ref([]);
    const roles = ref([]);
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
        title: "Email",
        key: "email",
      },
      {
        title: "Role",
        key: "role",
      },
      {
        title: "Edit",
        key: "edit",
      },
    ]);
    const addDialog = ref(false);
    const editDialog = ref(false);
    const confirmDeleteDialog = ref(false);
    const state = reactive({
      name: "",
      title: "",
      email: "",
      phone: "",
      role: "",
      password: "",
    });
    const rules = {
      name: { required },
      email: { required, email },
      phone: { required },
      role: { required },
      password: { required },
    };
    const v$ = useVuelidate(rules, state);
    function loadValues() {
      loadingValues.value = true;
      fetch("/users/getUsers")
        .then((response) => {
          response
            .json()
            .then((results) => {
              loadingValues.value = false;
              values.value = results;
            })
            .catch(() => {
              loadingValues.value = false;
            });
        })
        .catch(() => {
          loading.value = false;
        });
    }

    function loadRoles() {
      loading.value = true;
      fetch("/users/getRoles")
        .then((response) => {
          response
            .json()
            .then((results) => {
              loading.value = false;
              roles.value = results;
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
      state.title = "";
      state.email = "";
      state.phone = "";
      state.role = "";
    }

    function activateEditDialog(item) {
      editingItem.value = JSON.parse(JSON.stringify(item));
      editDialog.value = true;
      state.name = item.name;
      state.title = item.title;
      state.email = item.email;
      state.phone = item.phone;
      state.role = item.roleid;
      state.password = "unchangedpassword";
    }

    function create() {
      loading.value = true;
      const formData = new FormData();
      formData.append("name", state.name);
      formData.append("title", state.title);
      formData.append("email", state.email);
      formData.append("phone", state.phone);
      formData.append("role", state.role);
      formData.append("password", state.password);
      fetch("/users/addUser", {
        body: formData,
        method: "POST",
      })
        .then((response) => {
          loading.value = false;
          addDialog.value = false;

          if (response.status !== 200 && response.status !== 201) {
            response.json().then((resp) => {
              store.commit("setMessage", {
                type: "error",
                text: "Failed to save User! " + resp.error,
                timeout: 2000,
              });
              return;
            });
          } else {
            response.json().then(() => {
              loadValues();
              store.commit("setMessage", {
                type: "primary",
                text: "User saved successfully!",
                timeout: 2000,
              });
            });
          }
        })
        .catch((error) => {
          loading.value = false;
          store.commit("setMessage", {
            type: "error",
            text: "Failed to save User!",
            timeout: 2000,
          });
          console.error("Error:", error);
        });
    }

    function saveEdit() {
      loading.value = true;
      const formData = new FormData();
      formData.append("name", state.name);
      formData.append("title", state.title);
      formData.append("email", state.email);
      formData.append("phone", state.phone);
      formData.append("role", state.role);
      formData.append("password", state.password);
      fetch("/users/editUser/" + editingItem.value.id, {
        body: formData,
        method: "POST",
      })
        .then((response) => {
          loading.value = false;
          editDialog.value = false;
          if (response.status !== 200 && response.status !== 201) {
            response.json().then((resp) => {
              store.commit("setMessage", {
                type: "error",
                text: "Failed to edit User! " + resp.error,
                timeout: 2000,
              });
              return;
            });
          } else {
            response.json().then(() => {
              loadValues();
              store.commit("setMessage", {
                type: "primary",
                text: "User edited successfully!",
                timeout: 2000,
              });
            });
          }
        })
        .catch((error) => {
          loading.value = false;
          store.commit("setMessage", {
            type: "error",
            text: "Failed to edit User!",
            timeout: 2000,
          });
          console.error("Error:", error);
        });
    }

    function remove() {
      loading.value = true;
      const formData = new FormData();
      confirmDeleteDialog.value = false;
      fetch("/users/deleteUser/" + editingItem.value.id, {
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
                text: "Failed to delete User! " + resp.error,
                timeout: 2000,
              });
              return;
            });
          } else {
            response.json().then(() => {
              loadValues();
              store.commit("setMessage", {
                type: "primary",
                text: "User delete successfully!",
                timeout: 2000,
              });
            });
          }
        })
        .catch((error) => {
          loading.value = false;
          store.commit("setMessage", {
            type: "error",
            text: "Failed to delete User!",
            timeout: 2000,
          });
          console.error("Error:", error);
        });
    }

    onMounted(() => {
      loadValues();
      loadRoles();
    });

    return {
      loading,
      loadingValues,
      values,
      headers,
      addDialog,
      editDialog,
      state,
      v$,
      editingItem,
      confirmDeleteDialog,
      roles,
      password_show,
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
