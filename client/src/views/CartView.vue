<script setup lang="ts">
import { useCartStore } from "@/stores/cart";
import { formatPrice } from "@/utils/format";

const cartStore = useCartStore();
</script>

<template>
  <main>
    <h1>Coșul curent</h1>
    <p v-if="cartStore.items.length === 0">Coșul e gol.</p>
    <ul v-else>
      <li v-for="item in cartStore.items" :key="item.productId">
        {{ item.name }} — {{ formatPrice(item.priceAtAdd) }} ×
        <input type="number" min="0" :value="item.quantity" @change="
          cartStore.updateQuantity(
            item.productId,
            Number(($event.target as HTMLInputElement).value)
          )
          " />
        <button type="button" @click="cartStore.remove(item.productId)">
          Elimină
        </button>
      </li>
    </ul>
    <p><strong>Total: {{ formatPrice(cartStore.total) }}</strong></p>
    <RouterLink to="/scan">Înapoi la catalog</RouterLink>
    <RouterLink to="/checkout">Continuă către checkout</RouterLink>
  </main>
</template>
