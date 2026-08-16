<template>
  <v-dialog
    max-width="760"
    :model-value="modelValue"
    scrollable
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <v-card class="rounded-lg">
      <v-toolbar color="primary" density="comfortable">
        <v-toolbar-title class="text-h6 font-weight-bold">Board Settings</v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="emit('update:modelValue', false)">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-tabs v-model="tab" bg-color="grey-lighten-4">
        <v-tab value="members">Members</v-tab>
        <v-tab value="labels">Labels</v-tab>
        <v-tab value="statuses">Statuses</v-tab>
        <v-tab value="fields">Custom Fields</v-tab>
        <v-tab value="forms">Intake Forms</v-tab>
      </v-tabs>

      <v-card-text style="max-height: 60vh">
        <v-window v-model="tab">
          <!-- MEMBERS -->
          <v-window-item value="members">
            <v-table density="compact">
              <tbody>
                <tr v-for="m in board?.members" :key="m.user_id">
                  <td>{{ m.user_name }}</td>
                  <td>
                    <v-chip size="small" variant="tonal">{{ m.role }}</v-chip>
                  </td>
                  <td class="text-right">
                    <v-btn color="error" icon size="x-small" variant="text" @click="removeMember(m)">
                      <v-icon size="16">mdi-close</v-icon>
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
            <v-row align="center" class="mt-4" dense>
              <v-col cols="6">
                <v-autocomplete
                  v-model="newMemberId"
                  density="compact"
                  hide-details
                  item-title="name"
                  item-value="id"
                  :items="userList"
                  label="Add person"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="4">
                <v-select
                  v-model="newMemberRole"
                  density="compact"
                  hide-details
                  :items="['MEMBER', 'OBSERVER', 'OWNER']"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="2">
                <v-btn block color="primary" variant="tonal" @click="addMember">Add</v-btn>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- LABELS -->
          <v-window-item value="labels">
            <div class="d-flex flex-wrap ga-2 mb-4">
              <v-chip v-for="l in board?.labels" :key="l.id" closable :color="l.color" @click:close="removeLabel(l)">
                {{ l.name || "(unnamed)" }}
              </v-chip>
            </div>
            <v-row dense>
              <v-col cols="6">
                <v-text-field v-model="newLabelName" density="compact" hide-details label="Name" variant="outlined" />
              </v-col>
              <v-col cols="4">
                <v-text-field v-model="newLabelColor" density="compact" hide-details label="Color (#hex)" variant="outlined" />
              </v-col>
              <v-col cols="2">
                <v-btn block color="primary" variant="tonal" @click="addLabel">Add</v-btn>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- STATUSES -->
          <v-window-item value="statuses">
            <v-table density="compact">
              <tbody>
                <tr v-for="s in board?.statuses" :key="s.id">
                  <td>
                    <v-chip :color="s.color" size="small" variant="flat">{{ s.name }}</v-chip>
                  </td>
                  <td>{{ s.category }}</td>
                  <td class="text-right">
                    <v-btn color="error" icon size="x-small" variant="text" @click="removeStatus(s)">
                      <v-icon size="16">mdi-close</v-icon>
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
            <v-row class="mt-4" dense>
              <v-col cols="4">
                <v-text-field v-model="newStatusName" density="compact" hide-details label="Name" variant="outlined" />
              </v-col>
              <v-col cols="4">
                <v-select
                  v-model="newStatusCategory"
                  density="compact"
                  hide-details
                  :items="['TODO', 'IN_PROGRESS', 'DONE']"
                  label="Category"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="4">
                <v-btn block color="primary" variant="tonal" @click="addStatus">Add</v-btn>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- CUSTOM FIELDS -->
          <v-window-item value="fields">
            <v-table density="compact">
              <tbody>
                <tr v-for="f in board?.custom_fields" :key="f.id">
                  <td>{{ f.name }}</td>
                  <td>{{ f.type }}</td>
                </tr>
              </tbody>
            </v-table>
            <v-row class="mt-4" dense>
              <v-col cols="5">
                <v-text-field v-model="newFieldName" density="compact" hide-details label="Name" variant="outlined" />
              </v-col>
              <v-col cols="4">
                <v-select
                  v-model="newFieldType"
                  density="compact"
                  hide-details
                  :items="['TEXT', 'NUMBER', 'DATE', 'CHECKBOX', 'DROPDOWN']"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="3">
                <v-btn block color="primary" variant="tonal" @click="addField">Add</v-btn>
              </v-col>
            </v-row>
          </v-window-item>

          <!-- FORMS -->
          <v-window-item value="forms">
            <v-table class="mb-4" density="compact">
              <tbody>
                <tr v-for="f in forms" :key="f.id">
                  <td>{{ f.title }}</td>
                  <td>
                    <code>{{ publicFormUrl(f.slug) }}</code>
                  </td>
                  <td class="text-right">
                    <v-btn color="error" icon size="x-small" variant="text" @click="removeForm(f)">
                      <v-icon size="16">mdi-close</v-icon>
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
            <v-alert class="mb-4" density="compact" type="info" variant="tonal">
              A public form lets anyone with the link raise a card without
              signing in — e.g. "Report a maintenance issue".
            </v-alert>
            <v-row dense>
              <v-col cols="4">
                <v-text-field v-model="newForm.title" density="compact" hide-details label="Title" variant="outlined" />
              </v-col>
              <v-col cols="3">
                <v-text-field v-model="newForm.slug" density="compact" hide-details label="URL slug" variant="outlined" />
              </v-col>
              <v-col cols="3">
                <v-select
                  v-model="newForm.list_id"
                  density="compact"
                  hide-details
                  item-title="name"
                  item-value="id"
                  :items="board?.lists"
                  label="Adds to list"
                  variant="outlined"
                />
              </v-col>
              <v-col cols="2">
                <v-btn block color="primary" variant="tonal" @click="addForm">Add</v-btn>
              </v-col>
            </v-row>
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
  import { reactive, ref, watch } from "vue";
  import { useStore } from "vuex";

  const props = defineProps({
    modelValue: { type: Boolean, default: false },
    board: { type: Object, default: null },
  });
  const emit = defineEmits(["update:modelValue", "changed"]);

  const store = useStore();
  const tab = ref("members");
  const userList = ref([]);
  const forms = ref([]);

  const newMemberId = ref(null);
  const newMemberRole = ref("MEMBER");
  const newLabelName = ref("");
  const newLabelColor = ref("#1867C0");
  const newStatusName = ref("");
  const newStatusCategory = ref("TODO");
  const newFieldName = ref("");
  const newFieldType = ref("TEXT");
  const newForm = reactive({ title: "", slug: "", list_id: null });

  function publicFormUrl(slug) {
    return `${window.location.origin}/BoardForm?slug=${encodeURIComponent(slug)}`;
  }

  async function loadUsers() {
    const res = await fetch("/boards/users");
    const data = await res.json();
    userList.value = data.data || [];
  }

  async function loadForms() {
    if (!props.board) return;
    const res = await fetch(`/boards/${props.board.id}/forms`);
    const data = await res.json();
    forms.value = data.data || [];
  }

  async function addMember() {
    if (!newMemberId.value) return;
    await fetch(`/boards/${props.board.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: newMemberId.value, role: newMemberRole.value }),
    });
    newMemberId.value = null;
    emit("changed");
  }

  async function removeMember(member) {
    await fetch(`/boards/${props.board.id}/members/${member.user_id}`, { method: "DELETE" });
    emit("changed");
  }

  async function addLabel() {
    if (!newLabelColor.value.trim()) {
      store.commit("setMessage", { type: "error", text: "A color is required" });
      return;
    }
    await fetch(`/boards/${props.board.id}/labels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newLabelName.value, color: newLabelColor.value }),
    });
    newLabelName.value = "";
    emit("changed");
  }

  async function removeLabel(label) {
    await fetch(`/boards/labels/${label.id}`, { method: "DELETE" });
    emit("changed");
  }

  async function addStatus() {
    if (!newStatusName.value.trim()) return;
    await fetch(`/boards/${props.board.id}/statuses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newStatusName.value, category: newStatusCategory.value }),
    });
    newStatusName.value = "";
    emit("changed");
  }

  async function removeStatus(status) {
    await fetch(`/boards/statuses/${status.id}`, { method: "DELETE" });
    emit("changed");
  }

  async function addField() {
    if (!newFieldName.value.trim()) return;
    await fetch(`/boards/${props.board.id}/custom-fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFieldName.value, type: newFieldType.value }),
    });
    newFieldName.value = "";
    emit("changed");
  }

  async function addForm() {
    if (!newForm.title.trim() || !newForm.slug.trim() || !newForm.list_id) {
      store.commit("setMessage", { type: "error", text: "Title, slug and list are all required" });
      return;
    }
    const res = await fetch(`/boards/${props.board.id}/forms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newForm, is_public: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      store.commit("setMessage", { type: "error", text: data.error });
      return;
    }
    newForm.title = "";
    newForm.slug = "";
    newForm.list_id = null;
    await loadForms();
  }

  async function removeForm(form) {
    await fetch(`/boards/forms/${form.id}`, { method: "DELETE" });
    await loadForms();
  }

  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return;
      loadUsers();
      loadForms();
    },
  );
</script>
