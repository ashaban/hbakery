<template>
  <v-container fluid>
    <v-dialog
      v-model="addDialog"
      transition="dialog-top-transition"
      width="auto"
    >
      <v-card class="rounded-xl pa-4" elevation="10">
        <v-toolbar class="rounded-lg flex-wrap px-4" color="primary" flat>
          <div class="d-flex align-center flex-wrap">
            <v-icon class="mr-2 text-white">mdi-account</v-icon>
            <span class="text-white font-weight-bold text-h6">{{ $t('addUser') }}</span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="addDialog = false" />
        </v-toolbar>
        <v-card-text class="pt-6">
          <v-text-field
            v-model="state.name"
            bg-color="#BDBDBD"
            :error-messages="v$.name.$errors.map(e => e.$message)"
            :label="$t('fullName')"
            required
            @blur="v$.name.$touch"
            @input="v$.name.$touch"
          />
          <v-text-field
            v-model="state.title"
            bg-color="#BDBDBD"
            :label="$t('title')"
          />
          <v-text-field
            v-model="state.email"
            bg-color="#BDBDBD"
            :error-messages="v$.email.$errors.map(e => e.$message)"
            :label="$t('email')"
            required
            @blur="v$.email.$touch"
            @input="v$.email.$touch"
          />
          <v-text-field
            v-model="state.phone"
            bg-color="#BDBDBD"
            :error-messages="v$.phone.$errors.map(e => e.$message)"
            :label="$t('phoneNumber')"
            required
            @blur="v$.phone.$touch"
            @input="v$.phone.$touch"
          />
          <v-autocomplete
            v-model="state.mda"
            bg-color="#BDBDBD"
            clearable
            :error-messages="mdaordev_partner"
            item-title="name"
            item-value="id"
            :items="mdas"
            :label="$t('mda')"
          />
          <v-autocomplete
            v-model="state.dev_partner"
            bg-color="#BDBDBD"
            clearable
            :error-messages="mdaordev_partner"
            item-title="name"
            item-value="id"
            :items="dev_partners"
            :label="$t('developmentPartner')"
          />
          <v-autocomplete
            v-model="state.role"
            bg-color="#BDBDBD"
            :error-messages="v$.role.$errors.map(e => e.$message)"
            item-title="name"
            item-value="id"
            :items="roles"
            :label="$t('role')"
            required
            @blur="v$.role.$touch"
            @change="v$.role.$touch"
          />
          <v-text-field
            v-model="state.password"
            :append-icon="password_show ? 'mdi-eye' : 'mdi-eye-off'"
            bg-color="#BDBDBD"
            :error-messages="v$.password.$errors.map(e => e.$message)"
            :label="$t('password')"
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
            {{ $t('add') }}
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
            <span class="text-white font-weight-bold text-h6">{{ $t('editUser') }}</span>
          </div>
          <v-spacer />
          <v-btn color="white" icon="mdi-close" @click="editDialog = false" />
        </v-toolbar>
        <v-card-text class="pt-6">
          <v-text-field
            v-model="editingItem.id"
            bg-color="#BDBDBD"
            disabled
            :label="$t('id')"
          />
          <v-text-field
            v-model="state.email"
            bg-color="#BDBDBD"
            density="compact"
            disabled
            :error-messages="v$.email.$errors.map(e => e.$message)"
            :label="$t('email')"
            required
            @blur="v$.email.$touch"
            @input="v$.email.$touch"
          />
          <v-text-field
            v-model="state.name"
            bg-color="#BDBDBD"
            :error-messages="v$.name.$errors.map(e => e.$message)"
            :label="$t('fullName')"
            required
            @blur="v$.name.$touch"
            @input="v$.name.$touch"
          />
          <v-text-field
            v-model="state.title"
            bg-color="#BDBDBD"
            :label="$t('title')"
          />
          <v-text-field
            v-model="state.phone"
            bg-color="#BDBDBD"
            :error-messages="v$.phone.$errors.map(e => e.$message)"
            :label="$t('phoneNumber')"
            required
            @blur="v$.phone.$touch"
            @input="v$.phone.$touch"
          />
          <v-autocomplete
            v-model="state.mda"
            bg-color="#BDBDBD"
            clearable
            :error-messages="mdaordev_partner"
            item-title="name"
            item-value="id"
            :items="mdas"
            :label="$t('mda')"
            required
          />
          <v-autocomplete
            v-model="state.dev_partner"
            bg-color="#BDBDBD"
            clearable
            :error-messages="mdaordev_partner"
            item-title="name"
            item-value="id"
            :items="dev_partners"
            :label="$t('developmentPartner')"
            required
          />
          <v-autocomplete
            v-model="state.role"
            bg-color="#BDBDBD"
            :error-messages="v$.role.$errors.map(e => e.$message)"
            item-title="name"
            item-value="id"
            :items="roles"
            :label="$t('role')"
            required
            @blur="v$.role.$touch"
            @change="v$.role.$touch"
          />
          <v-text-field
            v-model="state.password"
            bg-color="#BDBDBD"
            :label="$t('password')"
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
            {{ $t('save') }}
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
            {{ $t('cancel') }}
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
            {{ $t('delete') }}
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
    <v-dialog v-model="confirmDeleteDialog" persistent width="auto">
      <v-card>
        <v-toolbar
          color="warning"
          :title="$t('confirmDeletingUser') + ' ' + state.name"
        >
          <v-btn color="white" icon="mdi-close" @click="confirmDeleteDialog = false" />
        </v-toolbar>
        <v-card-text>{{ $t('confirmDeleteUserMessage', { name: state.name }) }}</v-card-text>
        <div class="d-flex justify-end justify-space-between">
          <v-btn color="success" @click="confirmDeleteDialog = false">{{ $t('cancel') }}</v-btn>
          <v-btn color="error" @click="remove">{{ $t('proceed') }}</v-btn>
        </div>
      </v-card>
    </v-dialog>
    <v-toolbar class="rounded-lg mb-2 px-4" color="primary" flat height="60">
      <v-toolbar-title class="text-white font-weight-bold text-h6">
        <v-icon class="mr-2" color="white">mdi-account</v-icon>
        {{ $t('users') }}
      </v-toolbar-title>
      <v-spacer />
      <v-btn
        class="text-white font-weight-medium"
        color="#1A237E"
        size="small"
        @click="activateAddDialog"
      >
        <v-icon start>mdi-plus</v-icon>
        {{ $t('addUser') }}
      </v-btn>
    </v-toolbar>
    <v-card class="rounded-lg">
      <v-card-text>
        <v-progress-linear :active="loadingValues" :indeterminate="loadingValues" />
        <v-data-table
          class="elevation-1"
          dense
          :headers="headers"
          height="300"
          :items="values"
        >
          <template #item.edit="{ item }">
            <v-icon color="#3F51B5" @click="activateEditDialog(item)">mdi-square-edit-outline</v-icon>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>
<script>
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useStore } from 'vuex'
  import { useVuelidate } from '@vuelidate/core'
  import { email, required } from '@vuelidate/validators'

  export default {
    setup () {
      const store = useStore()
      const loading = ref(false)
      const loadingValues = ref(false)
      const password_show = ref(false)
      const values = ref([])
      const dev_partners = ref([])
      const mdas = ref([])
      const roles = ref([])
      const editingItem = ref({})
      const headers = ref([{
        title: 'ID',
        key: 'id',
      }, {
        title: 'Name',
        key: 'name',
      }, {
        title: 'Email',
        key: 'email',
      }, {
        title: 'MDA',
        key: 'mda',
      }, {
        title: 'Dev Partner',
        key: 'dev_partner',
      }, {
        title: 'Role',
        key: 'role',
      }, {
        title: 'Edit',
        key: 'edit',
      }])
      const addDialog = ref(false)
      const editDialog = ref(false)
      const confirmDeleteDialog = ref(false)
      const state = reactive({
        name: '',
        title: '',
        email: '',
        phone: '',
        mda: '',
        dev_partner: '',
        role: '',
        password: '',
      })
      const rules = {
        name: { required },
        email: { required, email },
        phone: { required },
        role: { required },
        password: { required },
      }
      const mdaordev_partner = computed(() => {
        if(!state.mda && !state.dev_partner) {
          return 'Either MDA or Development Partner must be selected'
        } else if(state.mda && state.dev_partner) {
          return 'You cant select both MDA and Dev Partners'
        }
        return ''
      })
      const v$ = useVuelidate(rules, state)
      function loadValues () {
        loadingValues.value = true
        fetch('/users/getUsers').then(response => {
          response.json().then(results => {
            loadingValues.value = false
            values.value = results
          }).catch(() => {
            loadingValues.value = false
          })
        }).catch(() => {
          loading.value = false
        })
      }

      function loadDevPartners () {
        loading.value = true
        fetch('/devPartners/getDevPartner').then(response => {
          response.json().then(results => {
            loading.value = false
            dev_partners.value = results
          }).catch(() => {
            loading.value = false
          })
        }).catch(() => {
          loading.value = false
        })
      }

      function loadMDA () {
        loading.value = true
        fetch('/mda/getMDA').then(response => {
          response.json().then(results => {
            loading.value = false
            mdas.value = results
            results
          }).catch(() => {
            loading.value = false
          })
        }).catch(() => {
          loading.value = false
        })
      }

      function loadRoles () {
        loading.value = true
        fetch('/users/getRoles').then(response => {
          response.json().then(results => {
            loading.value = false
            roles.value = results
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
        state.title = ''
        state.email = ''
        state.phone = ''
        state.mda = ''
        state.dev_partner = ''
        state.role = ''
      }

      function activateEditDialog (item) {
        editingItem.value = JSON.parse(JSON.stringify(item))
        editDialog.value = true
        state.name = item.name
        state.title = item.title
        state.email = item.email
        state.phone = item.phone
        state.mda = item.mdaid
        state.dev_partner = item.dev_partnerid
        state.role = item.roleid
        state.password = 'unchangedpassword'
      }

      function create () {
        loading.value = true
        const formData = new FormData();
        formData.append('name', state.name);
        formData.append('title', state.title);
        formData.append('email', state.email);
        formData.append('phone', state.phone);
        formData.append('mda', state.mda);
        formData.append('dev_partner', state.dev_partner);
        formData.append('role', state.role);
        formData.append('password', state.password);
        fetch('/users/addUser', {
          body: formData,
          method: 'POST',
        }).then(response => {
          loading.value = false
          addDialog.value = false

          if (response.status !== 200 && response.status !== 201) {
            response.json().then(resp => {
              store.commit('setMessage', {
                type: 'error',
                text: 'Failed to save User! ' + resp.error,
                timeout: 2000,
              });
              return;
            })
          } else {
            response.json().then(() => {
              loadValues()
              store.commit('setMessage', {
                type: 'primary',
                text: 'User saved successfully!',
                timeout: 2000,
              });
            });
          }
        })
          .catch(error => {
            loading.value = false
            store.commit('setMessage', {
              type: 'error',
              text: 'Failed to save User!',
              timeout: 2000,
            });
            console.error('Error:', error);
          });
      }

      function saveEdit () {
        loading.value = true
        const formData = new FormData();
        formData.append('name', state.name);
        formData.append('title', state.title);
        formData.append('email', state.email);
        formData.append('phone', state.phone);
        formData.append('mda', state.mda);
        formData.append('dev_partner', state.dev_partner);
        formData.append('role', state.role);
        formData.append('password', state.password);
        fetch('/users/editUser/' + editingItem.value.id, {
          body: formData,
          method: 'POST',
        }).then(response => {
          loading.value = false
          editDialog.value = false
          if (response.status !== 200 && response.status !== 201) {
            response.json().then(resp => {
              store.commit('setMessage', {
                type: 'error',
                text: 'Failed to edit User! ' + resp.error,
                timeout: 2000,
              });
              return;
            })
          } else {
            response.json().then(() => {
              loadValues()
              store.commit('setMessage', {
                type: 'primary',
                text: 'User edited successfully!',
                timeout: 2000,
              });
            });
          }
        })
          .catch(error => {
            loading.value = false
            store.commit('setMessage', {
              type: 'error',
              text: 'Failed to edit User!',
              timeout: 2000,
            });
            console.error('Error:', error);
          });
      }

      function remove () {
        loading.value = true
        const formData = new FormData();
        confirmDeleteDialog.value = false
        fetch('/users/deleteUser/' + editingItem.value.id, {
          body: formData,
          method: 'DELETE',
        }).then(response => {
          loading.value = false
          editDialog.value = false
          if (response.status !== 200 && response.status !== 201) {
            response.json().then(resp => {
              store.commit('setMessage', {
                type: 'error',
                text: 'Failed to delete User! ' + resp.error,
                timeout: 2000,
              });
              return;
            })
          } else {
            response.json().then(() => {
              loadValues()
              store.commit('setMessage', {
                type: 'primary',
                text: 'User delete successfully!',
                timeout: 2000,
              });
            });
          }
        })
          .catch(error => {
            loading.value = false
            store.commit('setMessage', {
              type: 'error',
              text: 'Failed to delete User!',
              timeout: 2000,
            });
            console.error('Error:', error);
          });
      }

      onMounted(() => {
        loadValues()
        loadDevPartners()
        loadMDA()
        loadRoles()
      })

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
        dev_partners,
        mdas,
        roles,
        password_show,
        mdaordev_partner,
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
