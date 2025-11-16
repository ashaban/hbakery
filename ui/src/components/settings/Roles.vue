<template>
  <v-container fluid>
    <!-- Add Role Dialog -->
    <v-dialog
      v-model="addDialog"
      transition="dialog-bottom-transition"
      width="900"
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
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="roleForm.name"
                bg-color="#BDBDBD"
                :error-messages="nameErrors"
                label="Role technical name (admin, cashier)"
                @blur="validateName"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="roleForm.display"
                bg-color="#BDBDBD"
                :error-messages="displayErrors"
                label="Display name (Administrator, Sales Officer)"
                @blur="validateDisplay"
              />
            </v-col>
          </v-row>

          <h4 class="mt-6 mb-2 text-h6 font-weight-bold">Tasks Assignment</h4>

          <div class="d-flex flex-row ga-4" style="min-height: 500px">
            <!-- Available Tasks by Category -->
            <v-card class="flex-1 pa-3" elevation="3">
              <div class="d-flex justify-space-between align-center mb-3">
                <h4 class="font-weight-bold">Available Tasks</h4>
                <v-chip color="primary" size="small" variant="flat">
                  {{ unassignedTasks.length }} tasks
                </v-chip>
              </div>
              <div class="tasks-container">
                <div
                  v-for="category in availableTaskCategories"
                  :key="category"
                  class="category-section"
                >
                  <v-expansion-panels variant="accordion">
                    <v-expansion-panel
                      :title="`${category} (${getCategoryTaskCount(category, 'available')})`"
                    >
                      <template #text>
                        <div class="category-tasks">
                          <v-checkbox
                            v-for="task in getTasksByCategory(
                              category,
                              'available',
                            )"
                            :key="task.id"
                            v-model="selectedAvailableTasks"
                            class="task-checkbox"
                            density="compact"
                            hide-details
                            :label="task.display"
                            :value="task.id"
                          />
                        </div>
                      </template>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </div>
                <div
                  v-if="unassignedTasks.length === 0"
                  class="text-caption text-grey text-center pa-4"
                >
                  No available tasks
                </div>
              </div>
              <v-card-actions class="px-0 pt-3">
                <v-btn
                  block
                  color="primary"
                  :disabled="selectedAvailableTasks.length === 0"
                  variant="tonal"
                  @click="assignSelectedTasks"
                >
                  <v-icon start>mdi-arrow-right</v-icon>
                  Assign Selected ({{ selectedAvailableTasks.length }})
                </v-btn>
              </v-card-actions>
            </v-card>

            <!-- Assigned Tasks by Category -->
            <v-card class="flex-1 pa-3" elevation="3">
              <div class="d-flex justify-space-between align-center mb-3">
                <h4 class="font-weight-bold">Assigned Tasks</h4>
                <v-chip color="primary" size="small" variant="flat">
                  {{ roleForm.tasks.length }} tasks
                </v-chip>
              </div>
              <div class="tasks-container">
                <div
                  v-for="category in assignedTaskCategories"
                  :key="category"
                  class="category-section"
                >
                  <v-expansion-panels variant="accordion">
                    <v-expansion-panel
                      :title="`${category} (${getCategoryTaskCount(category, 'assigned')})`"
                    >
                      <template #text>
                        <div class="category-tasks">
                          <div
                            v-for="task in getTasksByCategory(
                              category,
                              'assigned',
                            )"
                            :key="task.id"
                            class="task-item"
                          >
                            <span class="task-text">{{ task.display }}</span>
                            <v-btn
                              icon
                              size="x-small"
                              variant="text"
                              @click="removeTask(task)"
                            >
                              <v-icon color="error" size="16">mdi-close</v-icon>
                            </v-btn>
                          </div>
                        </div>
                      </template>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </div>
                <div
                  v-if="roleForm.tasks.length === 0"
                  class="text-caption text-grey text-center pa-4"
                >
                  No tasks assigned
                </div>
              </div>
              <v-card-actions class="px-0 pt-3">
                <v-btn
                  block
                  color="error"
                  :disabled="roleForm.tasks.length === 0"
                  variant="tonal"
                  @click="removeAllTasks"
                >
                  <v-icon start>mdi-delete-sweep</v-icon>
                  Remove All
                </v-btn>
              </v-card-actions>
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
      width="900"
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
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="roleForm.name"
                bg-color="#BDBDBD"
                :error-messages="nameErrors"
                label="Role Technical Name"
                @blur="validateName"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="roleForm.display"
                bg-color="#BDBDBD"
                :error-messages="displayErrors"
                label="Role Display Name"
                @blur="validateDisplay"
              />
            </v-col>
          </v-row>

          <h4 class="mt-6 mb-2 text-h6 font-weight-bold">Tasks Assignment</h4>

          <div class="d-flex flex-row ga-4" style="min-height: 500px">
            <!-- Available Tasks by Category -->
            <v-card class="flex-1 pa-3" elevation="3">
              <div class="d-flex justify-space-between align-center mb-3">
                <h4 class="font-weight-bold">Available Tasks</h4>
                <v-chip color="primary" size="small" variant="flat">
                  {{ unassignedTasks.length }} tasks
                </v-chip>
              </div>
              <div class="tasks-container">
                <div
                  v-for="category in availableTaskCategories"
                  :key="category"
                  class="category-section"
                >
                  <v-expansion-panels variant="accordion">
                    <v-expansion-panel
                      :title="`${category} (${getCategoryTaskCount(category, 'available')})`"
                    >
                      <template #text>
                        <div class="category-tasks">
                          <v-checkbox
                            v-for="task in getTasksByCategory(
                              category,
                              'available',
                            )"
                            :key="task.id"
                            v-model="selectedAvailableTasks"
                            class="task-checkbox"
                            density="compact"
                            hide-details
                            :label="task.display"
                            :value="task.id"
                          />
                        </div>
                      </template>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </div>
                <div
                  v-if="unassignedTasks.length === 0"
                  class="text-caption text-grey text-center pa-4"
                >
                  No available tasks
                </div>
              </div>
              <v-card-actions class="px-0 pt-3">
                <v-btn
                  block
                  color="primary"
                  :disabled="selectedAvailableTasks.length === 0"
                  variant="tonal"
                  @click="assignSelectedTasks"
                >
                  <v-icon start>mdi-arrow-right</v-icon>
                  Assign Selected ({{ selectedAvailableTasks.length }})
                </v-btn>
              </v-card-actions>
            </v-card>

            <!-- Assigned Tasks by Category -->
            <v-card class="flex-1 pa-3" elevation="3">
              <div class="d-flex justify-space-between align-center mb-3">
                <h4 class="font-weight-bold">Assigned Tasks</h4>
                <v-chip color="primary" size="small" variant="flat">
                  {{ roleForm.tasks.length }} tasks
                </v-chip>
              </div>
              <div class="tasks-container">
                <div
                  v-for="category in assignedTaskCategories"
                  :key="category"
                  class="category-section"
                >
                  <v-expansion-panels variant="accordion">
                    <v-expansion-panel
                      :title="`${category} (${getCategoryTaskCount(category, 'assigned')})`"
                    >
                      <template #text>
                        <div class="category-tasks">
                          <div
                            v-for="task in getTasksByCategory(
                              category,
                              'assigned',
                            )"
                            :key="task.id"
                            class="task-item"
                          >
                            <span class="task-text">{{ task.display }}</span>
                            <v-btn
                              icon
                              size="x-small"
                              variant="text"
                              @click="removeTask(task)"
                            >
                              <v-icon color="error" size="16">mdi-close</v-icon>
                            </v-btn>
                          </div>
                        </div>
                      </template>
                    </v-expansion-panel>
                  </v-expansion-panels>
                </div>
                <div
                  v-if="roleForm.tasks.length === 0"
                  class="text-caption text-grey text-center pa-4"
                >
                  No tasks assigned
                </div>
              </div>
              <v-card-actions class="px-0 pt-3">
                <v-btn
                  block
                  color="error"
                  :disabled="roleForm.tasks.length === 0"
                  variant="tonal"
                  @click="removeAllTasks"
                >
                  <v-icon start>mdi-delete-sweep</v-icon>
                  Remove All
                </v-btn>
              </v-card-actions>
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

    <!-- View Role Dialog -->
    <v-dialog
      v-model="viewDialog"
      transition="dialog-bottom-transition"
      width="700"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg px-4" color="info" flat>
          <v-icon class="mr-2 text-white">mdi-eye</v-icon>
          <span class="text-white font-weight-bold text-h6">
            View Role – {{ viewRole.display }}
          </span>
          <v-spacer />
          <v-btn class="text-white" icon @click="viewDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                bg-color="#BDBDBD"
                label="Role Technical Name"
                :model-value="viewRole.name"
                readonly
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field
                bg-color="#BDBDBD"
                label="Role Display Name"
                :model-value="viewRole.display"
                readonly
              />
            </v-col>
          </v-row>

          <h4 class="mt-6 mb-2 text-h6 font-weight-bold">Assigned Tasks</h4>

          <div class="tasks-summary">
            <v-chip class="mb-3" color="primary" variant="flat">
              Total: {{ viewRole.tasks?.length || 0 }} tasks assigned
            </v-chip>

            <div class="categories-container">
              <div
                v-for="category in getRoleCategories(viewRole.tasks)"
                :key="category"
                class="category-card"
              >
                <v-card class="pa-3" elevation="2">
                  <div class="d-flex justify-space-between align-center mb-2">
                    <h5 class="font-weight-bold text-primary">
                      {{ category }}
                    </h5>
                    <v-chip color="primary" size="small" variant="outlined">
                      {{ getTaskCountByCategory(viewRole.tasks, category) }}
                    </v-chip>
                  </div>
                  <v-list density="compact">
                    <v-list-item
                      v-for="task in getTasksByCategoryForRole(
                        viewRole.tasks,
                        category,
                      )"
                      :key="task.id"
                      class="px-0"
                    >
                      <template #prepend>
                        <v-icon color="success" size="16"
                          >mdi-check-circle</v-icon
                        >
                      </template>
                      <v-list-item-title class="text-caption">
                        {{ task.display }}
                      </v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-card>
              </div>
            </div>

            <div
              v-if="!viewRole.tasks || viewRole.tasks.length === 0"
              class="text-center pa-6"
            >
              <v-icon color="grey" size="48">mdi-shield-off</v-icon>
              <div class="text-h6 text-grey mt-2">No Tasks Assigned</div>
              <div class="text-caption text-grey">
                This role doesn't have any permissions assigned yet.
              </div>
            </div>
          </div>
        </v-card-text>

        <v-card-actions class="justify-end pr-3 pb-3">
          <v-btn
            v-if="$store.getters.hasTask('can_add_settings')"
            color="primary"
            variant="elevated"
            @click="openEditDialog(viewRole)"
          >
            <v-icon start>mdi-pencil</v-icon>
            Edit Role
          </v-btn>
          <v-btn variant="tonal" @click="viewDialog = false"> Close </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Category Tasks Dialog -->
    <v-dialog
      v-model="categoryDialog"
      transition="dialog-bottom-transition"
      width="500"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg px-4" color="primary" flat>
          <v-icon class="mr-2 text-white">mdi-folder-eye</v-icon>
          <span class="text-white font-weight-bold text-h6">
            {{ selectedCategory }} Tasks
          </span>
          <v-spacer />
          <v-btn class="text-white" icon @click="categoryDialog = false">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </v-toolbar>

        <v-card-text class="pt-6">
          <v-chip class="mb-3" color="primary" variant="flat">
            {{ categoryTasks.length }} tasks in this category
          </v-chip>

          <v-list>
            <v-list-item
              v-for="task in categoryTasks"
              :key="task.id"
              class="px-0"
            >
              <template #prepend>
                <v-icon color="primary" size="16">mdi-check</v-icon>
              </template>
              <v-list-item-title>{{ task.display }}</v-list-item-title>
              <template #append>
                <v-chip size="x-small" variant="outlined">
                  {{ task.code }}
                </v-chip>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>

        <v-card-actions class="justify-end pr-3 pb-3">
          <v-btn variant="tonal" @click="categoryDialog = false"> Close </v-btn>
        </v-card-actions>
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
            <div class="task-summary">
              <div class="text-caption text-grey mb-1">
                {{ getTaskCount(item.tasks) }} tasks assigned
              </div>
              <div class="category-chips">
                <v-chip
                  v-for="category in getRoleCategories(item.tasks)"
                  :key="category"
                  class="ma-1"
                  color="primary"
                  size="x-small"
                  variant="outlined"
                  @click="openCategoryDialog(category, item.tasks)"
                >
                  {{ category }} ({{
                    getTaskCountByCategory(item.tasks, category)
                  }})
                </v-chip>
                <span
                  v-if="getTaskCount(item.tasks) === 0"
                  class="text-caption text-grey"
                >
                  No tasks assigned
                </span>
              </div>
            </div>
          </template>

          <template #item.actions="{ item }">
            <div class="d-flex">
              <v-icon
                class="mr-2"
                color="info"
                size="18"
                @click="openViewDialog(item)"
              >
                mdi-eye
              </v-icon>
              <v-icon
                v-if="$store.getters.hasTask('can_add_settings')"
                color="#3F51B5"
                size="18"
                @click="openEditDialog(item)"
              >
                mdi-square-edit-outline
              </v-icon>
            </div>
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
    const selectedAvailableTasks = ref([]);

    const loading = ref(false);

    const addDialog = ref(false);
    const editDialog = ref(false);
    const viewDialog = ref(false);
    const categoryDialog = ref(false);
    const confirmDelete = ref(false);

    const nameErrors = ref([]);
    const displayErrors = ref([]);

    const viewRole = reactive({
      id: null,
      name: "",
      display: "",
      tasks: [],
    });

    const selectedCategory = ref("");
    const categoryTasks = ref([]);

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
      { title: "Actions", key: "actions", sortable: false },
    ];

    // COMPUTED: Tasks NOT assigned to this role
    const unassignedTasks = computed(() =>
      allTasks.value.filter((t) => !roleForm.tasks.find((x) => x.id === t.id)),
    );

    // COMPUTED: Available task categories
    const availableTaskCategories = computed(() => {
      const categories = [
        ...new Set(unassignedTasks.value.map((task) => task.category)),
      ];
      return categories.sort();
    });

    // COMPUTED: Assigned task categories
    const assignedTaskCategories = computed(() => {
      const categories = [
        ...new Set(roleForm.tasks.map((task) => task.category)),
      ];
      return categories.sort();
    });

    // COMPUTED: Form validation
    const isFormValid = computed(() => {
      return (
        roleForm.name.trim() !== "" &&
        roleForm.display.trim() !== "" &&
        nameErrors.value.length === 0 &&
        displayErrors.value.length === 0
      );
    });

    // METHODS: Task categorization
    function getTasksByCategory(category, type) {
      const tasks =
        type === "available" ? unassignedTasks.value : roleForm.tasks;
      return tasks.filter((task) => task.category === category);
    }

    function getTasksByCategoryForRole(tasks, category) {
      if (!tasks || !Array.isArray(tasks)) return [];
      return tasks.filter((task) => task.category === category);
    }

    function getCategoryTaskCount(category, type) {
      return getTasksByCategory(category, type).length;
    }

    function getRoleCategories(tasks) {
      if (!tasks || !Array.isArray(tasks)) return [];
      const categories = [...new Set(tasks.map((task) => task.category))];
      return categories.sort();
    }

    function getTaskCountByCategory(tasks, category) {
      if (!tasks || !Array.isArray(tasks)) return 0;
      return tasks.filter((task) => task.category === category).length;
    }

    // BUG FIX: Proper task count
    function getTaskCount(tasks) {
      if (!tasks || !Array.isArray(tasks)) return 0;
      return tasks.length;
    }

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

    // TASK MANAGEMENT
    function assignSelectedTasks() {
      selectedAvailableTasks.value.forEach((taskId) => {
        const task = allTasks.value.find((t) => t.id === taskId);
        if (task && !roleForm.tasks.find((t) => t.id === taskId)) {
          roleForm.tasks.push(task);
        }
      });
      selectedAvailableTasks.value = [];
    }

    function assignTask(task) {
      if (!roleForm.tasks.find((t) => t.id === task.id)) {
        roleForm.tasks.push(task);
      }
    }

    function removeTask(task) {
      roleForm.tasks = roleForm.tasks.filter((t) => t.id !== task.id);
    }

    function removeAllTasks() {
      roleForm.tasks = [];
    }

    // DIALOG MANAGEMENT
    function openViewDialog(role) {
      viewRole.id = role.id;
      viewRole.name = role.name;
      viewRole.display = role.display;
      viewRole.tasks = [...(role.tasks || [])];
      viewDialog.value = true;
    }

    function openCategoryDialog(category, tasks) {
      selectedCategory.value = category;
      categoryTasks.value = tasks.filter((task) => task.category === category);
      categoryDialog.value = true;
    }

    function openAddDialog() {
      roleForm.id = null;
      roleForm.name = "";
      roleForm.display = "";
      roleForm.tasks = [];
      selectedAvailableTasks.value = [];
      nameErrors.value = [];
      displayErrors.value = [];
      addDialog.value = true;
    }

    function openEditDialog(role) {
      roleForm.id = role.id;
      roleForm.name = role.name;
      roleForm.display = role.display;
      roleForm.tasks = [...(role.tasks || [])];
      selectedAvailableTasks.value = [];
      nameErrors.value = [];
      displayErrors.value = [];
      editDialog.value = true;
      viewDialog.value = false; // Close view dialog if open
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
      viewDialog,
      categoryDialog,
      confirmDelete,
      roleForm,
      viewRole,
      selectedCategory,
      categoryTasks,
      unassignedTasks,
      selectedAvailableTasks,
      availableTaskCategories,
      assignedTaskCategories,
      nameErrors,
      displayErrors,
      isFormValid,
      openAddDialog,
      openEditDialog,
      openViewDialog,
      openCategoryDialog,
      createRole,
      saveRoleEdit,
      deleteRole,
      assignTask,
      removeTask,
      assignSelectedTasks,
      removeAllTasks,
      validateName,
      validateDisplay,
      getTasksByCategory,
      getTasksByCategoryForRole,
      getCategoryTaskCount,
      getRoleCategories,
      getTaskCountByCategory,
      getTaskCount,
    };
  },
};
</script>

<style scoped>
.flex-1 {
  flex: 1;
}

.tasks-container {
  min-height: 400px;
  max-height: 400px;
  overflow-y: auto;
}

.categories-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.category-card {
  break-inside: avoid;
}

.category-section {
  margin-bottom: 8px;
}

.category-tasks {
  padding: 8px 0;
}

.task-checkbox {
  margin-bottom: 4px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  margin-bottom: 4px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.task-text {
  font-size: 0.875rem;
  flex: 1;
}

.task-summary {
  min-width: 200px;
}

.category-chips {
  display: flex;
  flex-wrap: wrap;
}

.v-expansion-panel {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  margin-bottom: 8px;
}

.v-expansion-panel::before {
  box-shadow: none;
}

.v-chip {
  cursor: pointer;
  transition: all 0.2s ease;
}

.v-chip:hover {
  transform: scale(1.05);
}

/* Make category chips clickable */
.category-chips .v-chip {
  cursor: pointer;
}

.category-chips .v-chip:hover {
  background-color: #e3f2fd;
}
</style>
