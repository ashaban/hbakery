<template>
  <v-container fluid>
    <!-- Add Role Dialog -->
    <v-dialog
      v-model="addDialog"
      transition="dialog-bottom-transition"
      width="750"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg px-4" color="primary" flat>
          <v-icon class="mr-2 text-white">mdi-shield-plus</v-icon>
          <span class="text-white font-weight-bold text-h6">Add Role</span>
          <v-spacer />
          <v-btn class="text-white" icon @click="addDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-text-field
            v-model="roleForm.name"
            bg-color="#BDBDBD"
            :error-messages="nameErrors"
            label="Role technical name (admin, cashier)"
            @blur="validateName"
          />

          <v-text-field
            v-model="roleForm.display"
            bg-color="#BDBDBD"
            :error-messages="displayErrors"
            label="Display name (Administrator, Sales Officer)"
            @blur="validateDisplay"
          />

          <h4 class="mt-6 mb-2 text-h6 font-weight-bold">Tasks Assignment</h4>

          <div class="d-flex flex-row ga-4">
            <!-- Available Tasks -->
            <v-card class="flex-1 pa-3" elevation="3">
              <h4 class="font-weight-bold mb-3">Available Tasks</h4>
              <div class="tasks-container">
                <v-chip
                  v-for="t in unassignedTasks"
                  :key="t.id"
                  class="ma-1"
                  color="primary"
                  size="small"
                  variant="outlined"
                  @click="assignTask(t)"
                >
                  {{ t.display }}
                </v-chip>
                <div
                  v-if="unassignedTasks.length === 0"
                  class="text-caption text-grey text-center pa-4"
                >
                  No available tasks
                </div>
              </div>
            </v-card>

            <!-- Assigned Tasks -->
            <v-card class="flex-1 pa-3" elevation="3">
              <h4 class="font-weight-bold mb-3">Assigned Tasks</h4>
              <div class="tasks-container">
                <v-chip
                  v-for="t in roleForm.tasks"
                  :key="t.id"
                  class="ma-1"
                  closable
                  color="primary"
                  size="small"
                  variant="flat"
                  @click:close="removeTask(t)"
                >
                  {{ t.display }}
                </v-chip>
                <div
                  v-if="roleForm.tasks.length === 0"
                  class="text-caption text-grey text-center pa-4"
                >
                  No tasks assigned
                </div>
              </div>
            </v-card>
          </div>
        </v-card-text>

        <div class="d-flex justify-end pr-3 pb-3">
          <v-btn
            color="success"
            :disabled="!isFormValid"
            :loading="loading"
            variant="elevated"
            @click="createRole"
          >
            <v-icon start>mdi-check</v-icon>
            Save Role
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Edit Role Dialog -->
    <v-dialog
      v-model="editDialog"
      transition="dialog-bottom-transition"
      width="750"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg px-4" color="primary" flat>
          <v-icon class="mr-2 text-white">mdi-shield-edit</v-icon>
          <span class="text-white font-weight-bold text-h6">
            Edit Role – {{ roleForm.display }}
          </span>
          <v-spacer />
          <v-btn class="text-white" icon @click="editDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-text-field
            v-model="roleForm.name"
            bg-color="#BDBDBD"
            :error-messages="nameErrors"
            label="Role Technical Name"
            @blur="validateName"
          />

          <v-text-field
            v-model="roleForm.display"
            bg-color="#BDBDBD"
            :error-messages="displayErrors"
            label="Role Display Name"
            @blur="validateDisplay"
          />

          <h4 class="mt-6 mb-2 text-h6 font-weight-bold">Tasks Assignment</h4>

          <div class="d-flex flex-row ga-4">
            <!-- Available Tasks -->
            <v-card class="flex-1 pa-3" elevation="3">
              <h4 class="font-weight-bold mb-3">Available Tasks</h4>
              <div class="tasks-container">
                <v-chip
                  v-for="t in unassignedTasks"
                  :key="t.id"
                  class="ma-1"
                  color="primary"
                  size="small"
                  variant="outlined"
                  @click="assignTask(t)"
                >
                  {{ t.display }}
                </v-chip>
                <div
                  v-if="unassignedTasks.length === 0"
                  class="text-caption text-grey text-center pa-4"
                >
                  No available tasks
                </div>
              </div>
            </v-card>

            <!-- Assigned Tasks -->
            <v-card class="flex-1 pa-3" elevation="3">
              <h4 class="font-weight-bold mb-3">Assigned Tasks</h4>
              <div class="tasks-container">
                <v-chip
                  v-for="t in roleForm.tasks"
                  :key="t.id"
                  class="ma-1"
                  closable
                  color="primary"
                  size="small"
                  variant="flat"
                  @click:close="removeTask(t)"
                >
                  {{ t.display }}
                </v-chip>
                <div
                  v-if="roleForm.tasks.length === 0"
                  class="text-caption text-grey text-center pa-4"
                >
                  No tasks assigned
                </div>
              </div>
            </v-card>
          </div>
        </v-card-text>

        <div class="d-flex justify-space-between pr-3 pb-3">
          <v-btn
            color="success"
            :disabled="!isFormValid"
            :loading="loading"
            variant="elevated"
            @click="saveRoleEdit"
          >
            <v-icon start>mdi-content-save</v-icon>
            Save
          </v-btn>

          <v-btn color="error" variant="elevated" @click="confirmDelete = true">
            <v-icon start>mdi-delete</v-icon>
            Delete
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- DELETE CONFIRMATION -->
    <v-dialog v-model="confirmDelete" width="450">
      <v-card class="rounded-xl">
        <v-toolbar class="px-4" color="warning" flat>
          <v-icon class="mr-2 text-white">mdi-alert</v-icon>
          <span class="text-white font-weight-bold">Delete Role</span>
          <v-spacer />
          <v-btn class="text-white" icon @click="confirmDelete = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pt-4">
          Are you sure you want to delete role
          <strong>{{ roleForm.display }}</strong
          >?
          <div class="text-caption text-warning mt-2">
            Note: This action cannot be undone.
          </div>
        </v-card-text>

        <div class="d-flex justify-end px-4 pb-4">
          <v-btn variant="text" @click="confirmDelete = false">Cancel</v-btn>
          <v-btn
            color="error"
            :loading="loading"
            variant="elevated"
            @click="deleteRole"
          >
            Delete
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- MAIN LIST -->
    <v-toolbar class="rounded-lg mb-4 px-4" color="primary" flat height="60">
      <v-toolbar-title class="text-white font-weight-bold text-h6">
        <v-icon class="mr-2" color="white">mdi-shield-account</v-icon>
        Roles & Permissions
      </v-toolbar-title>
      <v-spacer />
      <v-btn
        v-if="$store.getters.hasTask('can_add_settings')"
        class="text-white"
        color="#1A237E"
        size="small"
        @click="openAddDialog"
      >
        <v-icon start>mdi-plus</v-icon>
        Add Role
      </v-btn>
    </v-toolbar>

    <v-card class="rounded-lg">
      <v-card-text>
        <v-progress-linear :active="loading" indeterminate />

        <v-data-table
          class="elevation-1"
          dense
          :headers="headers"
          :items="roles"
          :loading="loading"
        >
          <template #item.tasks="{ item }">
            <div class="d-flex flex-wrap">
              <v-chip
                v-for="t in item.tasks"
                :key="t.id"
                class="ma-1"
                color="primary"
                size="small"
                variant="outlined"
              >
                {{ t.display }}
              </v-chip>
              <span
                v-if="!item.tasks || item.tasks.length === 0"
                class="text-caption text-grey"
              >
                No tasks assigned
              </span>
            </div>
          </template>

          <template
            v-if="$store.getters.hasTask('can_add_settings')"
            #item.edit="{ item }"
          >
            <v-icon color="#3F51B5" @click="openEditDialog(item)">
              mdi-square-edit-outline
            </v-icon>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<script>
import { computed, onMounted, reactive, ref } from "vue";

export default {
  name: "RolesManagement",

  setup() {
    const roles = ref([]);
    const allTasks = ref([]);

    const loading = ref(false);

    const addDialog = ref(false);
    const editDialog = ref(false);
    const confirmDelete = ref(false);

    const nameErrors = ref([]);
    const displayErrors = ref([]);

    const roleForm = reactive({
      id: null,
      name: "",
      display: "",
      tasks: [],
    });

    const headers = [
      { title: "ID", key: "id" },
      { title: "Technical Name", key: "name" },
      { title: "Display Name", key: "display" },
      { title: "Assigned Tasks", key: "tasks" },
      { title: "Edit", key: "edit", sortable: false },
    ];

    // COMPUTED: Tasks NOT assigned to this role
    const unassignedTasks = computed(() =>
      allTasks.value.filter((t) => !roleForm.tasks.find((x) => x.id === t.id)),
    );

    // COMPUTED: Form validation
    const isFormValid = computed(() => {
      return (
        roleForm.name.trim() !== "" &&
        roleForm.display.trim() !== "" &&
        nameErrors.value.length === 0 &&
        displayErrors.value.length === 0
      );
    });

    // VALIDATION FUNCTIONS
    function validateName() {
      nameErrors.value = [];
      if (!roleForm.name.trim()) {
        nameErrors.value.push("Technical name is required");
      }
      if (roleForm.name.includes(" ")) {
        nameErrors.value.push("Technical name should not contain spaces");
      }
    }

    function validateDisplay() {
      displayErrors.value = [];
      if (!roleForm.display.trim()) {
        displayErrors.value.push("Display name is required");
      }
    }

    // LOAD ROLES
    async function loadRoles() {
      loading.value = true;
      try {
        const res = await fetch("/roles");
        if (res.ok) {
          roles.value = await res.json();
        } else {
          console.error("Failed to load roles");
        }
      } catch (error) {
        console.error("Error loading roles:", error);
      } finally {
        loading.value = false;
      }
    }

    // LOAD TASKS
    async function loadTasks() {
      try {
        const res = await fetch("/tasks");
        if (res.ok) {
          allTasks.value = await res.json();
        } else {
          console.error("Failed to load tasks");
        }
      } catch (error) {
        console.error("Error loading tasks:", error);
      }
    }

    function openAddDialog() {
      roleForm.id = null;
      roleForm.name = "";
      roleForm.display = "";
      roleForm.tasks = [];
      nameErrors.value = [];
      displayErrors.value = [];
      addDialog.value = true;
    }

    async function createRole() {
      if (!isFormValid.value) return;

      loading.value = true;
      try {
        // First create the role
        const roleResponse = await fetch("/roles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: roleForm.name.trim(),
            display: roleForm.display.trim(),
          }),
        });

        if (!roleResponse.ok) {
          throw new Error("Failed to create role");
        }

        const newRole = await roleResponse.json();

        // Then assign tasks if any are selected
        if (roleForm.tasks.length > 0) {
          await fetch(`/roles/${newRole.id}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tasks: roleForm.tasks.map((t) => t.id),
            }),
          });
        }

        addDialog.value = false;
        await loadRoles();
      } catch (error) {
        console.error("Error creating role:", error);
      } finally {
        loading.value = false;
      }
    }

    function openEditDialog(role) {
      roleForm.id = role.id;
      roleForm.name = role.name;
      roleForm.display = role.display;
      roleForm.tasks = [...(role.tasks || [])];
      nameErrors.value = [];
      displayErrors.value = [];
      editDialog.value = true;
    }

    async function saveRoleEdit() {
      if (!isFormValid.value) return;

      loading.value = true;
      try {
        // Update role details
        await fetch(`/roles/${roleForm.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: roleForm.name.trim(),
            display: roleForm.display.trim(),
          }),
        });

        // Update task assignments
        await fetch(`/roles/${roleForm.id}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks: roleForm.tasks.map((t) => t.id),
          }),
        });

        editDialog.value = false;
        await loadRoles();
      } catch (error) {
        console.error("Error updating role:", error);
      } finally {
        loading.value = false;
      }
    }

    async function deleteRole() {
      loading.value = true;
      try {
        await fetch(`/roles/${roleForm.id}`, { method: "DELETE" });
        confirmDelete.value = false;
        editDialog.value = false;
        await loadRoles();
      } catch (error) {
        console.error("Error deleting role:", error);
      } finally {
        loading.value = false;
      }
    }

    function assignTask(task) {
      if (!roleForm.tasks.find((t) => t.id === task.id)) {
        roleForm.tasks.push(task);
      }
    }

    function removeTask(task) {
      roleForm.tasks = roleForm.tasks.filter((t) => t.id !== task.id);
    }

    onMounted(() => {
      loadRoles();
      loadTasks();
    });

    return {
      roles,
      allTasks,
      headers,
      loading,
      addDialog,
      editDialog,
      confirmDelete,
      roleForm,
      unassignedTasks,
      nameErrors,
      displayErrors,
      isFormValid,
      openAddDialog,
      openEditDialog,
      createRole,
      saveRoleEdit,
      deleteRole,
      assignTask,
      removeTask,
      validateName,
      validateDisplay,
    };
  },
};
</script>

<style scoped>
.flex-1 {
  flex: 1;
}

.tasks-container {
  min-height: 200px;
  max-height: 300px;
  overflow-y: auto;
}

.v-chip {
  cursor: pointer;
  transition: all 0.2s ease;
}

.v-chip:hover {
  transform: scale(1.05);
}
</style>
