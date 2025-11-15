<template>
  <v-container fluid>
    <!-- ADD USER -->
    <v-dialog
      v-model="addDialog"
      transition="dialog-top-transition"
      width="620"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg px-4" color="primary" flat>
          <v-icon class="mr-2 text-white">mdi-account-plus</v-icon>
          <span class="text-white font-weight-bold text-h6">Add User</span>
          <v-spacer />
          <v-btn color="white" icon @click="addDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-text-field
            v-model="state.name"
            bg-color="#BDBDBD"
            :error-messages="v$.name.$errors.map((e) => e.$message)"
            label="Full Name"
            required
            @blur="v$.name.$touch"
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
          />

          <v-text-field
            v-model="state.phone"
            bg-color="#BDBDBD"
            :error-messages="v$.phone.$errors.map((e) => e.$message)"
            label="Phone Number"
            required
            @blur="v$.phone.$touch"
          />

          <!-- MULTI ROLE SELECT -->
          <v-autocomplete
            v-model="state.roles"
            bg-color="#BDBDBD"
            chips
            closable-chips
            :error-messages="v$.roles.$errors.map((e) => e.$message)"
            item-title="display"
            item-value="id"
            :items="roles"
            label="Assign Roles"
            multiple
            @blur="v$.roles.$touch"
          />

          <!-- MULTI OUTLET SELECT -->
          <v-autocomplete
            v-model="state.outlets"
            bg-color="#BDBDBD"
            chips
            closable-chips
            item-title="name"
            item-value="id"
            :items="availableOutlets"
            label="Assigned Outlets"
            multiple
          />

          <v-text-field
            v-model="state.password"
            :append-icon="password_show ? 'mdi-eye' : 'mdi-eye-off'"
            bg-color="#BDBDBD"
            :error-messages="v$.password.$errors.map((e) => e.$message)"
            label="Password"
            :type="password_show ? 'text' : 'password'"
            @blur="v$.password.$touch"
            @click:append="password_show = !password_show"
          />
        </v-card-text>

        <div class="d-flex justify-end pr-3 pb-3">
          <v-btn
            color="success"
            :disabled="v$.$error"
            :loading="loading"
            @click="create"
          >
            <v-icon start>mdi-check</v-icon>
            Save
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- EDIT USER -->
    <v-dialog
      v-model="editDialog"
      transition="dialog-top-transition"
      width="620"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg px-4" color="primary" flat>
          <v-icon class="mr-2 text-white">mdi-account-edit</v-icon>
          <span class="text-white font-weight-bold text-h6">Edit User</span>
          <v-spacer />
          <v-btn color="white" icon @click="editDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-text-field
            v-model="editingItem.id"
            bg-color="#BDBDBD"
            disabled
            label="User ID"
          />

          <v-text-field
            v-model="state.email"
            bg-color="#BDBDBD"
            disabled
            label="Email"
          />

          <v-text-field
            v-model="state.name"
            bg-color="#BDBDBD"
            label="Full Name"
            @blur="v$.name.$touch"
          />

          <v-text-field
            v-model="state.title"
            bg-color="#BDBDBD"
            label="Title"
          />

          <v-text-field
            v-model="state.phone"
            bg-color="#BDBDBD"
            label="Phone Number"
            @blur="v$.phone.$touch"
          />

          <v-autocomplete
            v-model="state.roles"
            bg-color="#BDBDBD"
            chips
            closable-chips
            item-title="display"
            item-value="id"
            :items="roles"
            label="Assign Roles"
            multiple
          />

          <v-autocomplete
            v-model="state.outlets"
            bg-color="#BDBDBD"
            chips
            closable-chips
            item-title="name"
            item-value="id"
            :items="availableOutlets"
            label="Assigned Outlets"
            multiple
          />

          <v-text-field
            v-model="state.password"
            :append-icon="password_show ? 'mdi-eye' : 'mdi-eye-off'"
            bg-color="#BDBDBD"
            label="Password"
            :type="password_show ? 'text' : 'password'"
            @click:append="password_show = !password_show"
          />
        </v-card-text>

        <div class="d-flex justify-space-between pr-3 pb-3">
          <v-btn color="success" :loading="loading" @click="saveEdit">
            <v-icon start>mdi-content-save</v-icon> Save
          </v-btn>

          <v-btn color="black" @click="editDialog = false">
            <v-icon start>mdi-cancel</v-icon> Cancel
          </v-btn>

          <v-btn color="error" @click="confirmDeleteDialog = true">
            <v-icon start>mdi-delete</v-icon> Delete
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- DELETE CONFIRM -->
    <v-dialog v-model="confirmDeleteDialog" persistent width="450">
      <v-card class="rounded-xl">
        <v-toolbar class="px-4" color="warning" flat>
          <v-icon class="mr-2 text-white">mdi-alert</v-icon>
          <span class="text-white font-weight-bold">Delete User</span>
          <v-spacer />
          <v-btn color="white" icon @click="confirmDeleteDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pt-4">
          Confirm deleting user <strong>{{ state.name }}</strong
          >?
        </v-card-text>

        <div class="d-flex justify-end px-4 pb-4">
          <v-btn variant="text" @click="confirmDeleteDialog = false"
            >Cancel</v-btn
          >
          <v-btn color="error" variant="elevated" @click="remove">Delete</v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- MAIN LIST -->
    <v-toolbar class="rounded-lg mb-4 px-4" color="primary" flat>
      <v-toolbar-title class="text-white font-weight-bold text-h6">
        <v-icon class="mr-2 text-white">mdi-account</v-icon> Users
      </v-toolbar-title>
      <v-spacer />
      <v-btn
        v-if="$store.getters.hasTask('can_add_users')"
        class="text-white"
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
          :items="values"
        >
          <template #item.roles="{ item }">
            <v-chip
              v-for="r in item.roles"
              :key="r.id"
              class="ma-1"
              color="primary"
              size="small"
              variant="outlined"
            >
              {{ r.display }}
            </v-chip>
          </template>

          <template #item.outlets="{ item }">
            <v-chip
              v-for="o in item.outlets"
              :key="o.id"
              class="ma-1"
              color="primary"
              size="small"
              variant="outlined"
            >
              {{ o.name }}
            </v-chip>
          </template>

          <template
            v-if="$store.getters.hasTask('can_edit_users')"
            #item.edit="{ item }"
          >
            <v-icon color="#3F51B5" @click="activateEditDialog(item)">
              mdi-square-edit-outline
            </v-icon>
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

    const values = ref([]);
    const roles = ref([]);
    const availableOutlets = ref([]);

    const addDialog = ref(false);
    const editDialog = ref(false);
    const confirmDeleteDialog = ref(false);

    const editingItem = ref({});
    const password_show = ref(false);

    const state = reactive({
      name: "",
      title: "",
      email: "",
      phone: "",
      password: "",
      roles: [],
      outlets: [],
    });

    const rules = {
      name: { required },
      email: { required, email },
      phone: { required },
      password: { required },
      roles: { required },
    };

    const v$ = useVuelidate(rules, state);

    const headers = [
      { title: "ID", key: "id" },
      { title: "Name", key: "name" },
      { title: "Email", key: "email" },
      { title: "Roles", key: "roles" },
      { title: "Outlets", key: "outlets" },
      { title: "Edit", key: "edit" },
    ];

    function loadValues() {
      loadingValues.value = true;
      fetch("/users/getUsers")
        .then((r) => r.json())
        .then((data) => {
          values.value = data;
          loadingValues.value = false;
        })
        .catch(() => (loadingValues.value = false));
    }

    function loadRoles() {
      fetch("/users/getRoles")
        .then((r) => r.json())
        .then((data) => (roles.value = data));
    }

    function loadOutlets() {
      fetch("/outlets")
        .then((r) => r.json())
        .then((data) => (availableOutlets.value = data.data));
    }

    function activateAddDialog() {
      Object.assign(state, {
        name: "",
        title: "",
        email: "",
        phone: "",
        password: "",
        roles: [],
        outlets: [],
      });
      addDialog.value = true;
    }

    function activateEditDialog(item) {
      editingItem.value = item;

      Object.assign(state, {
        name: item.name,
        title: item.title,
        email: item.email,
        phone: item.phone,
        password: "unchangedpassword",
        roles: item.roles.map((r) => r.id),
        outlets: item.outlets.map((o) => o.id),
      });

      editDialog.value = true;
    }

    function create() {
      loading.value = true;

      const form = new FormData();
      for (const [k, v] of Object.entries(state)) {
        if (Array.isArray(v)) form.append(k, JSON.stringify(v));
        else form.append(k, v);
      }

      fetch("/users/addUser", { method: "POST", body: form })
        .then((res) => res.json())
        .then(() => {
          loading.value = false;
          addDialog.value = false;
          loadValues();
          store.commit("setMessage", {
            type: "success",
            text: "User saved successfully!",
            timeout: 2500,
          });
        });
    }

    function saveEdit() {
      loading.value = true;

      const form = new FormData();
      for (const [k, v] of Object.entries(state)) {
        if (Array.isArray(v)) form.append(k, JSON.stringify(v));
        else form.append(k, v);
      }

      fetch(`/users/editUser/${editingItem.value.id}`, {
        method: "POST",
        body: form,
      })
        .then((r) => r.json())
        .then(() => {
          loading.value = false;
          editDialog.value = false;
          loadValues();
          store.commit("setMessage", {
            type: "success",
            text: "User updated successfully!",
            timeout: 2500,
          });
        });
    }

    function remove() {
      loading.value = true;
      confirmDeleteDialog.value = false;

      fetch(`/users/deleteUser/${editingItem.value.id}`, { method: "DELETE" })
        .then((r) => r.json())
        .then(() => {
          loading.value = false;
          editDialog.value = false;
          loadValues();
          store.commit("setMessage", {
            type: "success",
            text: "User deleted successfully!",
            timeout: 2500,
          });
        });
    }

    onMounted(() => {
      loadValues();
      loadRoles();
      loadOutlets();
    });

    return {
      loading,
      loadingValues,
      roles,
      availableOutlets,
      values,
      headers,
      state,
      v$,
      addDialog,
      editDialog,
      confirmDeleteDialog,
      editingItem,
      password_show,
      activateAddDialog,
      activateEditDialog,
      create,
      saveEdit,
      remove,
    };
  },
};
</script>
