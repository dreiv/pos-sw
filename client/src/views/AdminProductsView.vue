<script setup lang="ts">
import { ref, onMounted, reactive } from "vue";
import { API_BASE } from "@/config";
import { formatPrice } from "@/utils/format";
import { notifyStateChanged } from "@/sync/broadcastChannel";
import type { ProductRecord } from "@/db/schema";

const products = ref<ProductRecord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const editingId = ref<string | null>(null);
const editDraft = reactive({ name: "", price: 0, stock: 0, barcode: "" });

const showNewForm = ref(false);
const newDraft = reactive({ name: "", price: 0, stock: 0, barcode: "" });

async function loadProducts() {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch(`${API_BASE}/products`);
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    products.value = await res.json();
  } catch (err) {
    error.value = "Nu am putut încărca produsele. Verifică dacă serverul rulează.";
    console.error("[admin] failed to load products:", err);
  } finally {
    loading.value = false;
  }
}

function startEdit(p: ProductRecord) {
  editingId.value = p.id;
  editDraft.name = p.name;
  editDraft.price = p.price;
  editDraft.stock = p.stock;
  editDraft.barcode = p.barcode;
}

function cancelEdit() {
  editingId.value = null;
}

async function saveEdit(id: string) {
  error.value = null;
  try {
    const res = await fetch(`${API_BASE}/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editDraft.name,
        price: Number(editDraft.price),
        stock: Number(editDraft.stock),
        barcode: editDraft.barcode,
      }),
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const updated: ProductRecord = await res.json();
    const idx = products.value.findIndex((p) => p.id === id);
    if (idx !== -1) products.value[idx] = updated;
    editingId.value = null;
    notifyStateChanged({ type: "products-changed" });
  } catch (err) {
    error.value = "Nu am putut salva modificările.";
    console.error("[admin] failed to update product:", err);
  }
}

async function deleteProduct(p: ProductRecord) {
  if (!confirm(`Ștergi definitiv „${p.name}"?`)) return;
  error.value = null;
  try {
    const res = await fetch(`${API_BASE}/products/${p.id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) throw new Error(`Server responded ${res.status}`);
    products.value = products.value.filter((x) => x.id !== p.id);
    notifyStateChanged({ type: "products-changed" });
  } catch (err) {
    error.value = "Nu am putut șterge produsul.";
    console.error("[admin] failed to delete product:", err);
  }
}

async function createProduct() {
  error.value = null;
  if (!newDraft.name.trim()) {
    error.value = "Numele este obligatoriu.";
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newDraft.name,
        price: Number(newDraft.price),
        stock: Number(newDraft.stock),
        barcode: newDraft.barcode,
      }),
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const created: ProductRecord = await res.json();
    products.value.push(created);
    newDraft.name = "";
    newDraft.price = 0;
    newDraft.stock = 0;
    newDraft.barcode = "";
    showNewForm.value = false;
    notifyStateChanged({ type: "products-changed" });
  } catch (err) {
    error.value = "Nu am putut crea produsul.";
    console.error("[admin] failed to create product:", err);
  }
}

onMounted(loadProducts);
</script>

<template>
  <main class="page page--wide">
    <div class="page-header">
      <h1>Admin — Produse</h1>
      <RouterLink to="/scan">Înapoi la catalog</RouterLink>
    </div>

    <p class="text-muted text-sm">
      Aceste modificări scriu direct în server (sursa de adevăr pentru catalog); ele nu trec prin
      coada offline de sincronizare.
    </p>

    <p v-if="error" class="notice notice--danger">{{ error }}</p>
    <p v-if="loading" class="notice">Se încarcă...</p>

    <table v-else class="products-table">
      <thead>
        <tr>
          <th>Nume</th>
          <th>Preț</th>
          <th>Stoc</th>
          <th>Cod de bare</th>
          <th class="actions-col">Acțiuni</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in products" :key="p.id" :class="{ editing: editingId === p.id }">
          <template v-if="editingId === p.id">
            <td><input class="input" v-model="editDraft.name" type="text" /></td>
            <td><input class="input" v-model.number="editDraft.price" type="number" step="0.01" min="0" /></td>
            <td><input class="input" v-model.number="editDraft.stock" type="number" min="0" /></td>
            <td><input class="input" v-model="editDraft.barcode" type="text" /></td>
            <td class="actions-col">
              <button type="button" class="btn btn--primary" @click="saveEdit(p.id)">Salvează</button>
              <button type="button" class="btn" @click="cancelEdit">Anulează</button>
            </td>
          </template>
          <template v-else>
            <td>{{ p.name }}</td>
            <td>{{ formatPrice(p.price) }}</td>
            <td>
              <span :class="{ 'text-danger': p.stock === 0 }">{{ p.stock }}</span>
            </td>
            <td>{{ p.barcode }}</td>
            <td class="actions-col">
              <button type="button" class="btn" @click="startEdit(p)">Editează</button>
              <button type="button" class="btn btn--danger" @click="deleteProduct(p)">Șterge</button>
            </td>
          </template>
        </tr>

        <tr v-if="products.length === 0">
          <td colspan="5" class="empty-cell text-muted">Niciun produs în catalog.</td>
        </tr>
      </tbody>
    </table>

    <div class="new-product">
      <button v-if="!showNewForm" type="button" class="btn btn--primary" @click="showNewForm = true">
        + Adaugă produs
      </button>

      <form v-else class="new-product-form" @submit.prevent="createProduct">
        <input class="input" v-model="newDraft.name" type="text" placeholder="Nume" required />
        <input class="input" v-model.number="newDraft.price" type="number" step="0.01" min="0" placeholder="Preț" />
        <input class="input" v-model.number="newDraft.stock" type="number" min="0" placeholder="Stoc" />
        <input class="input" v-model="newDraft.barcode" type="text" placeholder="Cod de bare" />
        <button type="submit" class="btn btn--primary">Salvează</button>
        <button type="button" class="btn" @click="showNewForm = false">Anulează</button>
      </form>
    </div>
  </main>
</template>

<style scoped>
.products-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-lg);
}

.products-table th,
.products-table td {
  text-align: left;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
}

.products-table th {
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.products-table tr.editing {
  background: var(--color-surface);
}

.products-table input {
  width: 100%;
}

.actions-col {
  white-space: nowrap;
  display: flex;
  gap: var(--space-sm);
}

.empty-cell {
  text-align: center;
  padding: var(--space-lg);
}

.new-product-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  align-items: center;
}
</style>
