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
            <span class="text-white font-weight-bold text-h6">Add Item</span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="addDialog = false" />
        </v-toolbar>
        <v-card-text class="pt-6">
          <v-form @submit.prevent>
            <v-text-field
              v-model="state.name"
              bg-color="#BDBDBD"
              :error-messages="v$.name.$errors.map(e => e.$message)"
              label="Unit Name"
              required
              @blur="v$.name.$touch"
              @input="v$.name.$touch"
            />
            <v-autocomplete
              v-model="state.unit"
              bg-color="#BDBDBD"
              :error-messages="v$.unit.$errors.map(e => e.$message)"
              :item-title="item => item ? `${item.name ?? ''}${item.shortname ? ` (${item.shortname})` : ''}` : ''"
              item-value="id"
              :items="units"
              label="Unit"
              required
              @blur="v$.unit.$touch"
              @change="v$.unit.$touch"
              :input-attrs="{ autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false' }"
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
            <br>
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
              :error-messages="v$.name.$errors.map(e => e.$message)"
              label="Unit"
              :readonly="loading"
              required
              @blur="v$.name.$touch"
              @input="v$.name.$touch"
            />
            <v-autocomplete
              v-model="state.unit"
              bg-color="#BDBDBD"
              :error-messages="v$.unit.$errors.map(e => e.$message)"
              item-title="short_name"
              item-value="id"
              :items="units"
              label="Unit"
              required
              @blur="v$.unit.$touch"
              @change="v$.unit.$touch"
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
        <v-toolbar
          color="warning"
          :title="'Confirm Deleteting ' + state.name"
        >
          <v-btn color="white" icon="mdi-close" @click="confirmDeleteDialog = false" />
        </v-toolbar>
        <v-card-text>Are you sure you want to delete {{ state.name }}?</v-card-text>
        <div class="d-flex justify-end justify-space-between">
          <v-btn color="success" @click="confirmDeleteDialog = false">Cancel</v-btn>
          <v-btn color="error" @click="remove">Proceed</v-btn>
        </div>
      </v-card>
    </v-dialog>
    <div class="d-flex justify-space-between mb-6">
      Items
      <v-btn class="text-black justify-end" size="small" @click="csvExport">
        <v-icon color="green" start>mdi-download</v-icon> Download
      </v-btn>
      <v-btn class="text-white justify-end" color="#1A237E" size="small" @click="activateAddDialog"><v-icon>mdi-plus</v-icon> Add New</v-btn>
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
      <template #item.edit="{ item }">
        <v-icon color="#3F51B5" @click="activateEditDialog(item)">mdi-square-edit-outline</v-icon>
      </template>
    </v-data-table>
  </v-container>
</template>
<script>
  import { onMounted, reactive, ref } from 'vue'
  import { useStore } from 'vuex'
  import { useVuelidate } from '@vuelidate/core'
  import { required } from '@vuelidate/validators'

  export default {
    setup () {
      const store = useStore()
      const loading = ref(false)
      const values = ref([])
      const units = ref([])
      const editingItem = ref({})
      const headers = ref([{
        title: 'ID',
        key: 'id',
      }, {
        title: 'Name',
        key: 'name',
      }, {
        title: 'Unit',
        key: 'unit',
      }, {
        title: 'Edit',
        key: 'edit',
      }])
      const addDialog = ref(false)
      const editDialog = ref(false)
      const confirmDeleteDialog = ref(false)
      const form = ref(false)
      const state = reactive({
        name: '',
        unit: '',
      })
      const rules = {
        name: { required },
        unit: { required },
      }
      const v$ = useVuelidate(rules, state)
      function loadValues () {
        loading.value = true
        fetch('/items').then(response => {
          response.json().then(results => {
            loading.value = false
            values.value = results
            results
          }).catch(() => {
            loading.value = false
          })
        }).catch(() => {
          loading.value = false
        })
      }

      function activateAddDialog () {
        v$.value.name.$touch()
        addDialog.value = true
        state.name = ''
      }

      function activateEditDialog (item) {
        editingItem.value = JSON.parse(JSON.stringify(item))
        editDialog.value = true
        state.name = item.name
        state.unit = item.unit
      }

      function loadUnits () {
        loading.value = true
        fetch('/units').then(response => {
          response.json().then(results => {
            units.value = results
            results
          })
        })
      }

      async function create () {
        v$.value.$touch()
        const valid = await v$.value.$validate();
        if(!valid) {
          return
        }
        loading.value = true
        addDialog.value = false
        const formData = new FormData();
        formData.append('name', state.name);
        formData.append('unit', state.unit);
        fetch('/items', {
          body: formData,
          method: 'POST',
        }).then(response => {
          loading.value = false

          if (response.status !== 200 && response.status !== 201) {
            response.json().then(resp => {
              store.commit('setMessage', {
                type: 'error',
                text: 'Failed to save Unit! ' + resp.error,
                timeout: 2000,
              });
              return;
            })
          } else {
            response.json().then(() => {
              loadValues()
              store.commit('setMessage', {
                type: 'primary',
                text: 'Unit saved successfully!',
                timeout: 2000,
              });
            });
          }
        })
          .catch(error => {
            loading.value = false
            store.commit('setMessage', {
              type: 'error',
              text: 'Failed to save Unit!',
              timeout: 2000,
            });
            console.error('Error:', error);
          });
      }

      async function saveEdit () {
        v$.value.$touch()
        const valid = await v$.value.$validate();
        if(!valid) {
          return
        }
        loading.value = true
        const formData = new FormData();
        formData.append('name', state.name);
        formData.append('unit', state.unit);
        fetch('/units/' + editingItem.value.id, {
          body: formData,
          method: 'PUT',
        }).then(response => {
          loading.value = false
          editDialog.value = false
          if (response.status !== 200 && response.status !== 201) {
            response.json().then(resp => {
              store.commit('setMessage', {
                type: 'error',
                text: 'Failed to edit Item! ' + resp.error,
                timeout: 2000,
              });
              return;
            })
          } else {
            response.json().then(() => {
              loadValues()
              store.commit('setMessage', {
                type: 'primary',
                text: 'Item edited successfully!',
                timeout: 2000,
              });
            });
          }
        })
          .catch(error => {
            loading.value = false
            store.commit('setMessage', {
              type: 'error',
              text: 'Failed to edit Item!',
              timeout: 2000,
            });
            console.error('Error:', error);
          });
      }

      function remove () {
        loading.value = true
        const formData = new FormData();
        confirmDeleteDialog.value = false
        fetch('/units/' + editingItem.value.id, {
          body: formData,
          method: 'DELETE',
        }).then(response => {
          loading.value = false
          editDialog.value = false
          if (response.status !== 200 && response.status !== 201) {
            response.json().then(resp => {
              store.commit('setMessage', {
                type: 'error',
                text: 'Failed to delete Item! ' + resp.error,
                timeout: 2000,
              });
              return;
            })
          } else {
            response.json().then(() => {
              loadValues()
              store.commit('setMessage', {
                type: 'primary',
                text: 'Item deleted successfully!',
                timeout: 2000,
              });
            });
          }
        })
          .catch(error => {
            loading.value = false
            store.commit('setMessage', {
              type: 'error',
              text: 'Failed to delete Item!',
              timeout: 2000,
            });
            console.error('Error:', error);
          });
      }

      function csvExport () {
        fetch('/units?response=csv').then(response => {
          response.text().then(csv => {
            const extension = 'csv'
            const encoding = 'data:text/csv;charset=utf-8,'
            const csvData = encoding + escape(csv)
            const link = document.createElement('a')
            link.setAttribute('href', csvData)
            link.setAttribute(
              'download',
              `Item.${extension}`
            )
            link.click()
          })
        }).catch(() => {
          loading.value = false
        })
      }

      onMounted(() => {
        loadValues()
        loadUnits()
      })

      return {
        loading,
        values,
        units,
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
      }
    },
  }
</script>
