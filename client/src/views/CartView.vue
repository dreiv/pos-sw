<script setup lang="ts">
import { useCartStore } from "@/stores/cart";
import { formatPrice } from "@/utils/format";

const cartStore = useCartStore();
</script>

<template>
  <main class="page">
    <h1>Coșul curent</h1>

    <p v-if="cartStore.items.length === 0" class="text-muted">
      Coșul e gol. <RouterLink to="/scan">Vezi catalogul</RouterLink> pentru a adăuga produse.
    </p>

    <template v-else>
      <ul class="cart-list">
        <li v-for="item in cartStore.items" :key="item.productId" class="row-card cart-row">
          <div class="cart-item-info">
            <span class="cart-item-name">{{ item.name }}</span>
            <span class="text-muted text-sm">{{ formatPrice(item.priceAtAdd) }} / buc.</span>
          </div>

          <input type="number" min="0" class="input qty-input" :value="item.quantity" @change="
            cartStore.updateQuantity(
              item.productId,
              Number(($event.target as HTMLInputElement).value)
            )
            " />

          <span class="line-total">{{ formatPrice(item.priceAtAdd * item.quantity) }}</span>

          <button type="button" class="btn btn--danger" @click="cartStore.remove(item.productId)">
            Elimină
          </button>
        </li>
      </ul>

      <div class="totals-row">
        <span>Total</span>
        <strong>{{ formatPrice(cartStore.total) }}</strong>
      </div>
    </template>

    <div class="actions-row">
      <RouterLink to="/scan">Înapoi la catalog</RouterLink>
      <RouterLink v-if="cartStore.items.length > 0" class="btn--pill btn--primary" to="/checkout">
        Continuă către checkout →
      </RouterLink>
    </div>
  </main>
</template>

<style scoped>
.cart-list {
  list-style: none;
  margin: 0 0 var(--space-lg);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.cart-row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
}

.cart-item-info {
  display: flex;
  flex-direction: column;
}

.cart-item-name {
  font-weight: 600;
}

.qty-input {
  width: 60px;
}

.line-total {
  font-weight: 600;
  min-width: 80px;
  text-align: right;
}
</style>
