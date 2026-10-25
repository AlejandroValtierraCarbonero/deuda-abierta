<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Dashboard from './components/Dashboard.vue'
import { isSnapshot } from './lib/data'
import { validateFinancialSnapshot } from './lib/validate.mjs'
import type { Snapshot } from './types'

const data = ref<Snapshot | null>(null)
const error = ref('')
const loading = ref(false)
async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/snapshot.json`, { cache: 'no-cache' })
    if (!response.ok) throw new Error(`No se pudieron cargar los datos (HTTP ${response.status}).`)
    const json: unknown = await response.json()
    if (!isSnapshot(json)) throw new Error('El fichero de datos no tiene el formato esperado.')
    validateFinancialSnapshot(json)
    data.value = json
  } catch (cause) {
    console.error('Error al cargar el observatorio', cause)
    error.value = cause instanceof Error ? cause.message : 'Error desconocido al cargar los datos.'
  } finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <Dashboard v-if="data" :data="data" />
  <main v-else class="boot-state" aria-live="polite">
    <div class="brand-mark">da</div>
    <h1>Deuda Abierta</h1>
    <template v-if="error"><p role="alert">{{ error }}</p><p>Comprueba que se ha ejecutado <code>npm run data:sync</code>.</p><button class="primary-button" @click="load">Reintentar</button></template>
    <p v-else-if="loading">Cargando datos del Banco de España…</p>
  </main>
</template>
