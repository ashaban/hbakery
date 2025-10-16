<template>
  <v-app>
    <!-- Navigation Bar -->
    <v-app-bar color="white" elevation="4" class="px-4">
      <v-container class="d-flex align-center">
        <v-avatar size="48" color="amber-lighten-5" class="mr-3">
          <v-icon color="amber-darken-3" size="28">mdi-food-croissant</v-icon>
        </v-avatar>
        <span class="text-h5 font-weight-bold text-amber-darken-3">Hanein Bakery</span>
        
        <v-spacer></v-spacer>
        
        <div class="d-none d-md-flex">
          <v-btn 
            v-for="item in navItems" 
            :key="item.text"
            variant="text" 
            :color="activeSection === item.section ? 'amber-darken-3' : 'grey-darken-2'"
            @click="scrollToSection(item.section)"
            class="mx-1 font-weight-medium"
          >
            {{ item.text }}
          </v-btn>
        </div>
        
        <v-spacer></v-spacer>
        
        <v-btn 
          color="amber-darken-3" 
          variant="flat" 
          @click="goToLogin"
          class="font-weight-bold mr-2"
        >
          <v-icon start>mdi-account</v-icon>
          Business Login
        </v-btn>
        
        <v-btn 
          color="brown-darken-3" 
          variant="outlined"
          @click="scrollToSection('order')"
          class="font-weight-bold"
        >
          <v-icon start>mdi-shopping</v-icon>
          Order Now
        </v-btn>
        
        <v-app-bar-nav-icon 
          class="d-md-none" 
          @click="drawer = !drawer"
        ></v-app-bar-nav-icon>
      </v-container>
    </v-app-bar>

    <!-- Mobile Navigation Drawer -->
    <v-navigation-drawer v-model="drawer" temporary location="right">
      <v-list>
        <v-list-item
          v-for="item in navItems"
          :key="item.text"
          @click="scrollToSection(item.section)"
        >
          <v-list-item-title>{{ item.text }}</v-list-item-title>
        </v-list-item>
        <v-list-item @click="goToLogin">
          <v-list-item-title class="text-amber-darken-3 font-weight-bold">
            <v-icon start>mdi-account</v-icon>
            Business Login
          </v-list-item-title>
        </v-list-item>
        <v-list-item @click="scrollToSection('order')">
          <v-list-item-title class="text-brown-darken-3 font-weight-bold">
            <v-icon start>mdi-shopping</v-icon>
            Order Now
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Hero Section -->
    <section id="home" class="hero-section">
      <v-parallax
        src="https://images.unsplash.com/photo-1509440159596-0249088772ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=2072&q=80"
        height="700"
      >
        <div class="d-flex flex-column fill-height justify-center align-center text-white">
          <div class="text-center hero-content">
            <v-icon size="80" color="amber-lighten-3" class="mb-4">mdi-cake-variant</v-icon>
            <h1 class="text-h2 text-white font-weight-bold mb-4 hero-title">
              Hanein Bakery
            </h1>
            <p class="text-h4 text-amber-lighten-3 mb-6 hero-subtitle">
              Freshly Baked with Love Since 2010
            </p>
            <p class="text-h6 text-amber-lighten-4 mb-8 max-width-600">
              Discover the finest artisan breads, decadent cakes, and delicious pastries made daily with premium ingredients and traditional recipes.
            </p>
            <div class="d-flex gap-4 justify-center flex-wrap">
              <v-btn 
                color="amber-darken-3" 
                size="x-large" 
                variant="flat"
                @click="scrollToSection('products')"
                class="font-weight-bold"
              >
                <v-icon start>mdi-store</v-icon>
                View Products
              </v-btn>
              <v-btn 
                color="white" 
                size="x-large" 
                variant="outlined"
                @click="scrollToSection('order')"
                class="font-weight-bold"
              >
                <v-icon start>mdi-shopping</v-icon>
                Order Online
              </v-btn>
            </div>
          </div>
        </div>
      </v-parallax>
    </section>

    <!-- Featured Products -->
    <section id="products" class="py-12 products-section" style="background: #faf7f2;">
      <v-container>
        <v-row>
          <v-col cols="12" class="text-center mb-8">
            <h2 class="text-h3 font-weight-bold text-brown-darken-3 mb-4">
              Our Fresh Products
            </h2>
            <p class="text-h6 text-grey-darken-1">
              Baked fresh daily using the finest ingredients
            </p>
          </v-col>
        </v-row>

        <!-- Bread Category -->
        <v-row class="mb-8">
          <v-col cols="12">
            <div class="d-flex align-center mb-6">
              <v-divider class="flex-grow-1"></v-divider>
              <h3 class="text-h4 font-weight-bold text-amber-darken-3 mx-4">
                <v-icon large color="amber-darken-3" class="mr-2">mdi-bread-slice</v-icon>
                Artisan Breads
              </h3>
              <v-divider class="flex-grow-1"></v-divider>
            </div>
          </v-col>
          <v-col
            v-for="product in breadProducts"
            :key="product.id"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <v-card class="product-card" elevation="6" hover>
              <v-img
                :src="product.image"
                height="200"
                cover
                class="product-image"
              >
                <template v-slot:placeholder>
                  <v-row class="fill-height ma-0" align="center" justify="center">
                    <v-progress-circular indeterminate color="amber-lighten-3"></v-progress-circular>
                  </v-row>
                </template>
              </v-img>
              
              <v-card-title class="text-h6 font-weight-bold text-brown-darken-3">
                {{ product.name }}
              </v-card-title>
              
              <v-card-text class="text-body-2 text-grey-darken-2">
                {{ product.description }}
              </v-card-text>
              
              <v-card-actions class="px-4 pb-4">
                <v-chip color="amber-lighten-5" variant="flat" class="text-amber-darken-3 font-weight-bold">
                  ${{ product.price }}
                </v-chip>
                <v-spacer></v-spacer>
                <v-btn
                  color="amber-darken-3"
                  variant="tonal"
                  size="small"
                  @click="addToCart(product)"
                >
                  <v-icon start>mdi-cart-plus</v-icon>
                  Add to Cart
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>

        <!-- Cakes Category -->
        <v-row class="mb-8">
          <v-col cols="12">
            <div class="d-flex align-center mb-6">
              <v-divider class="flex-grow-1"></v-divider>
              <h3 class="text-h4 font-weight-bold text-pink-darken-2 mx-4">
                <v-icon large color="pink-darken-2" class="mr-2">mdi-cake</v-icon>
                Decadent Cakes
              </h3>
              <v-divider class="flex-grow-1"></v-divider>
            </div>
          </v-col>
          <v-col
            v-for="product in cakeProducts"
            :key="product.id"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <v-card class="product-card" elevation="6" hover>
              <v-img
                :src="product.image"
                height="200"
                cover
                class="product-image"
              >
                <template v-slot:placeholder>
                  <v-row class="fill-height ma-0" align="center" justify="center">
                    <v-progress-circular indeterminate color="pink-lighten-3"></v-progress-circular>
                  </v-row>
                </template>
              </v-img>
              
              <v-card-title class="text-h6 font-weight-bold text-brown-darken-3">
                {{ product.name }}
              </v-card-title>
              
              <v-card-text class="text-body-2 text-grey-darken-2">
                {{ product.description }}
              </v-card-text>
              
              <v-card-actions class="px-4 pb-4">
                <v-chip color="pink-lighten-5" variant="flat" class="text-pink-darken-2 font-weight-bold">
                  ${{ product.price }}
                </v-chip>
                <v-spacer></v-spacer>
                <v-btn
                  color="pink-darken-2"
                  variant="tonal"
                  size="small"
                  @click="addToCart(product)"
                >
                  <v-icon start>mdi-cart-plus</v-icon>
                  Add to Cart
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>

        <!-- Pastries Category -->
        <v-row>
          <v-col cols="12">
            <div class="d-flex align-center mb-6">
              <v-divider class="flex-grow-1"></v-divider>
              <h3 class="text-h4 font-weight-bold text-deep-orange-darken-2 mx-4">
                <v-icon large color="deep-orange-darken-2" class="mr-2">mdi-croissant</v-icon>
                Fresh Pastries
              </h3>
              <v-divider class="flex-grow-1"></v-divider>
            </div>
          </v-col>
          <v-col
            v-for="product in pastryProducts"
            :key="product.id"
            cols="12"
            sm="6"
            md="4"
            lg="3"
          >
            <v-card class="product-card" elevation="6" hover>
              <v-img
                :src="product.image"
                height="200"
                cover
                class="product-image"
              >
                <template v-slot:placeholder>
                  <v-row class="fill-height ma-0" align="center" justify="center">
                    <v-progress-circular indeterminate color="deep-orange-lighten-3"></v-progress-circular>
                  </v-row>
                </template>
              </v-img>
              
              <v-card-title class="text-h6 font-weight-bold text-brown-darken-3">
                {{ product.name }}
              </v-card-title>
              
              <v-card-text class="text-body-2 text-grey-darken-2">
                {{ product.description }}
              </v-card-text>
              
              <v-card-actions class="px-4 pb-4">
                <v-chip color="deep-orange-lighten-5" variant="flat" class="text-deep-orange-darken-2 font-weight-bold">
                  ${{ product.price }}
                </v-chip>
                <v-spacer></v-spacer>
                <v-btn
                  color="deep-orange-darken-2"
                  variant="tonal"
                  size="small"
                  @click="addToCart(product)"
                >
                  <v-icon start>mdi-cart-plus</v-icon>
                  Add to Cart
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <!-- About Section -->
    <section id="about" class="py-12 about-section">
      <v-container>
        <v-row align="center">
          <v-col cols="12" md="6">
            <v-img
              src="https://images.unsplash.com/photo-1558961363-fa8fdf82db35?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
              height="400"
              cover
              class="rounded-lg"
              elevation="6"
            ></v-img>
          </v-col>
          
          <v-col cols="12" md="6">
            <div class="pl-md-6">
              <h2 class="text-h3 font-weight-bold text-brown-darken-3 mb-4">
                Our Story
              </h2>
              <p class="text-body-1 text-grey-darken-2 mb-4">
                Since 2010, Hanein Bakery has been serving the community with the finest baked goods. 
                Our master bakers combine traditional techniques with the highest quality ingredients 
                to create products that bring joy to every table.
              </p>
              
              <v-list class="transparent">
                <v-list-item
                  v-for="item in aboutFeatures"
                  :key="item.text"
                >
                  <template v-slot:prepend>
                    <v-avatar color="amber-lighten-5" size="40">
                      <v-icon color="amber-darken-3">{{ item.icon }}</v-icon>
                    </v-avatar>
                  </template>
                  <v-list-item-title class="text-h6 font-weight-medium text-brown-darken-3">
                    {{ item.text }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <!-- Production Excellence Section -->
    <section id="production" class="py-12 production-section" style="background: #fff8e1;">
      <v-container>
        <v-row>
          <v-col cols="12" class="text-center mb-8">
            <h2 class="text-h3 font-weight-bold text-brown-darken-3 mb-4">
              Our Production Excellence
            </h2>
            <p class="text-h6 text-grey-darken-1">
              Behind every delicious product is our commitment to quality and precision
            </p>
          </v-col>
        </v-row>
        
        <v-row>
          <v-col
            v-for="feature in productionFeatures"
            :key="feature.title"
            cols="12"
            md="4"
          >
            <v-card class="feature-card text-center pa-6" elevation="4" hover>
              <v-avatar size="80" color="amber-lighten-5" class="mb-4">
                <v-icon size="40" color="amber-darken-3">{{ feature.icon }}</v-icon>
              </v-avatar>
              <h3 class="text-h5 font-weight-bold text-brown-darken-3 mb-3">
                {{ feature.title }}
              </h3>
              <p class="text-body-1 text-grey-darken-2">
                {{ feature.description }}
              </p>
            </v-card>
          </v-col>
        </v-row>

        <v-row class="mt-8">
          <v-col cols="12" class="text-center">
            <v-btn 
              color="amber-darken-3" 
              variant="flat" 
              size="large"
              @click="goToLogin"
              class="font-weight-bold"
            >
              <v-icon start>mdi-chart-box</v-icon>
              View Production Dashboard
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <!-- Order Section -->
    <section id="order" class="py-12 order-section" style="background: linear-gradient(135deg, #5d4037 0%, #3e2723 100%);">
      <v-container>
        <v-row>
          <v-col cols="12" md="8" class="mx-auto">
            <v-card class="pa-8 text-center" color="rgba(255,255,255,0.95)" elevation="12">
              <h2 class="text-h3 font-weight-bold text-brown-darken-3 mb-4">
                Ready to Order?
              </h2>
              <p class="text-h6 text-grey-darken-2 mb-6">
                Fresh from our oven to your table
              </p>
              
              <v-row class="mb-6">
                <v-col cols="12" sm="6">
                  <v-card variant="outlined" class="pa-4" hover>
                    <v-icon size="48" color="amber-darken-3" class="mb-3">mdi-phone</v-icon>
                    <h3 class="text-h5 font-weight-bold text-brown-darken-3 mb-2">Call Us</h3>
                    <p class="text-body-1 text-grey-darken-2 mb-3">Speak directly with our team</p>
                    <v-btn color="amber-darken-3" variant="flat" block>
                      +255 655 011 555-HANEIN
                    </v-btn>
                  </v-card>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-card variant="outlined" class="pa-4" hover>
                    <v-icon size="48" color="amber-darken-3" class="mb-3">mdi-storefront</v-icon>
                    <h3 class="text-h5 font-weight-bold text-brown-darken-3 mb-2">Visit Us</h3>
                    <p class="text-body-1 text-grey-darken-2 mb-3">Come see our fresh selection</p>
                    <v-btn color="amber-darken-3" variant="flat" block>
                      Pongwe, Tanga, Tanzania
                    </v-btn>
                  </v-card>
                </v-col>
              </v-row>
              
              <v-alert type="info" variant="tonal" class="mb-4">
                <strong>Business Owners:</strong> Login to access production tracking and management tools
              </v-alert>
              
              <v-btn 
                color="amber-darken-3" 
                size="x-large" 
                variant="flat"
                @click="goToLogin"
                class="font-weight-bold"
              >
                <v-icon start>mdi-account</v-icon>
                Business Portal Login
              </v-btn>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </section>

    <!-- Footer -->
    <v-footer color="brown-darken-4" class="text-white">
      <v-container>
        <v-row>
          <v-col cols="12" md="4">
            <div class="d-flex align-center mb-4">
              <v-avatar size="40" color="amber-lighten-5" class="mr-3">
                <v-icon color="amber-darken-3">mdi-croissant</v-icon>
              </v-avatar>
              <span class="text-h5 font-weight-bold text-amber-lighten-3">Hanein Bakery</span>
            </div>
            <p class="text-body-2 text-amber-lighten-4">
              Freshly baked with passion since 2010. Quality ingredients, traditional recipes, modern production tracking.
            </p>
          </v-col>
          
          <v-col cols="12" md="4">
            <h3 class="text-h6 font-weight-bold text-amber-lighten-3 mb-4">Visit Us</h3>
            <div class="text-body-2 text-amber-lighten-4">
              <p class="d-flex align-center mb-2">
                <v-icon small class="mr-2">mdi-map-marker</v-icon>
                Pongwe, Tanga, Tanzania
              </p>
              <p class="d-flex align-center mb-2">
                <v-icon small class="mr-2">mdi-phone</v-icon>
                +255 655 011 555-HANEIN
              </p>
              <p class="d-flex align-center mb-2">
                <v-icon small class="mr-2">mdi-email</v-icon>
                orders@hanein.co.tz
              </p>
              <p class="d-flex align-center">
                <v-icon small class="mr-2">mdi-clock</v-icon>
                Thursday-Sunday: 6AM-8PM, Friday: 7AM-12PM
              </p>
            </div>
          </v-col>
          
          <v-col cols="12" md="4">
            <h3 class="text-h6 font-weight-bold text-amber-lighten-3 mb-4">Quick Links</h3>
            <v-list color="transparent" class="py-0">
              <v-list-item
                v-for="link in footerLinks"
                :key="link.text"
                @click="scrollToSection(link.section)"
                class="px-0"
              >
                <v-list-item-title class="text-body-2 text-blue cursor-pointer">
                  {{ link.text }}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-col>
        </v-row>
        
        <v-divider class="my-4" color="amber-lighten-3"></v-divider>
        
        <div class="text-center text-body-2 text-amber-lighten-4">
          &copy; 2024 Hanein Bakery. All rights reserved. | 
          <span class="cursor-pointer" @click="goToLogin">Production Management System</span>
        </div>
      </v-container>
    </v-footer>

    <!-- Shopping Cart Snackbar -->
    <v-snackbar v-model="showCartAlert" color="amber-darken-3" timeout="3000">
      <div class="d-flex align-center">
        <v-icon class="mr-2">mdi-cart-check</v-icon>
        {{ cartMessage }}
      </div>
    </v-snackbar>
  </v-app>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// Reactive data
const drawer = ref(false)
const activeSection = ref('home')
const showCartAlert = ref(false)
const cartMessage = ref('')

// Navigation items
const navItems = [
  { text: 'Home', section: 'home' },
  { text: 'Products', section: 'products' },
  { text: 'About', section: 'about' },
  { text: 'Production', section: 'production' },
  { text: 'Order', section: 'order' },
]

// Products data organized by category
const breadProducts = [
  {
    id: 1,
    name: 'Sourdough Loaf',
    description: 'Traditional slow-fermented sourdough with crispy crust',
    price: '6.99',
    image: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'bread'
  },
  {
    id: 2,
    name: 'Whole Wheat Bread',
    description: 'Nutritious whole wheat bread packed with fiber',
    price: '5.50',
    image: 'https://images.unsplash.com/photo-1598373182133-52452f7691ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'bread'
  },
  {
    id: 3,
    name: 'Bingo Medium',
    description: 'Classic product with golden crispy crust',
    price: '3.99',
    image: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'bread'
  },
  {
    id: 4,
    name: 'Multigrain Loaf',
    description: 'Hearty multigrain bread with seeds and grains',
    price: '7.25',
    image: 'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'bread'
  }
]

const cakeProducts = [
  {
    id: 5,
    name: 'Chocolate Fudge Cake',
    description: 'Rich chocolate cake with fudge frosting',
    price: '32.99',
    image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'cake'
  },
  {
    id: 6,
    name: 'Red Velvet Cake',
    description: 'Classic red velvet with cream cheese frosting',
    price: '35.50',
    image: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'cake'
  },
  {
    id: 7,
    name: 'Carrot Cake',
    description: 'Moist carrot cake with walnuts and cream cheese',
    price: '28.75',
    image: 'https://images.unsplash.com/photo-1596223575327-99a5be4faf1e?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'cake'
  },
  {
    id: 8,
    name: 'Cheesecake',
    description: 'New York style cheesecake with berry compote',
    price: '26.99',
    image: 'https://images.unsplash.com/photo-1567306301408-9b74779a11af?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'cake'
  }
]

const pastryProducts = [
  {
    id: 9,
    name: 'Croissants',
    description: 'Buttery French croissants, flaky and golden',
    price: '3.25',
    image: 'https://images.unsplash.com/photo-1555507032-6f60b2b8a891?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'pastry'
  },
  {
    id: 10,
    name: 'Danish Pastries',
    description: 'Assorted fruit and cream cheese danishes',
    price: '4.50',
    image: 'https://images.unsplash.com/photo-1558318122-37e0f6a8a2f9?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'pastry'
  },
  {
    id: 11,
    name: 'Cinnamon Rolls',
    description: 'Fresh cinnamon rolls with cream cheese glaze',
    price: '4.25',
    image: 'https://images.unsplash.com/photo-1590080875515-6a3dab13739e?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'pastry'
  },
  {
    id: 12,
    name: 'Fruit Tarts',
    description: 'Seasonal fruit tarts with pastry cream',
    price: '5.75',
    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    category: 'pastry'
  }
]

// About features
const aboutFeatures = [
  { icon: 'mdi-heart', text: 'Family Owned Since 2010' },
  { icon: 'mdi-leaf', text: 'Premium Quality Ingredients' },
  { icon: 'mdi-chef-hat', text: 'Master Artisan Bakers' },
  { icon: 'mdi-truck-delivery', text: 'Fresh Daily Delivery' }
]

// Production features
const productionFeatures = [
  {
    icon: 'mdi-scale',
    title: 'Precision Tracking',
    description: 'Every ingredient measured and tracked for consistent quality and cost control.'
  },
  {
    icon: 'mdi-chart-timeline',
    title: 'Production Analytics',
    description: 'Real-time insights into baking schedules, yield rates, and efficiency metrics.'
  },
  {
    icon: 'mdi-quality-high',
    title: 'Quality Assurance',
    description: 'Comprehensive quality checks and batch tracking for every product we bake.'
  }
]

// Footer links
const footerLinks = [
  { text: 'Our Products', section: 'products' },
  { text: 'Our Story', section: 'about' },
  { text: 'Production Excellence', section: 'production' },
  { text: 'Place Order', section: 'order' },
  { text: 'Business Login', section: 'login' }
]

// Methods
function scrollToSection(sectionId) {
  drawer.value = false
  if (sectionId === 'login') {
    goToLogin()
    return
  }
  const element = document.getElementById(sectionId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
    activeSection.value = sectionId
  }
}

function goToLogin() {
  router.push('/login')
}

function addToCart(product) {
  cartMessage.value = `${product.name} added to cart!`
  showCartAlert.value = true
  // In a real app, you would add to a cart store
  console.log('Added to cart:', product)
}

// Scroll spy for active section
function handleScroll() {
  const sections = ['home', 'products', 'about', 'production', 'order']
  const scrollY = window.pageYOffset

  for (const section of sections) {
    const element = document.getElementById(section)
    if (element) {
      const offsetTop = element.offsetTop - 100
      const offsetBottom = offsetTop + element.offsetHeight

      if (scrollY >= offsetTop && scrollY < offsetBottom) {
        activeSection.value = section
        break
      }
    }
  }
}

// Lifecycle hooks
onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.hero-section {
  position: relative;
}

.hero-content {
  max-width: 800px;
  padding: 0 20px;
}

.hero-title {
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.hero-subtitle {
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
}

.max-width-600 {
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.product-card {
  border-radius: 16px;
  transition: all 0.3s ease;
  height: 100%;
}

.product-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.15) !important;
}

.product-image {
  transition: transform 0.3s ease;
}

.product-card:hover .product-image {
  transform: scale(1.05);
}

.feature-card {
  border-radius: 16px;
  transition: all 0.3s ease;
  height: 100%;
}

.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1) !important;
}

.gap-4 {
  gap: 16px;
}

.cursor-pointer {
  cursor: pointer;
}

:deep(.v-parallax__image) {
  filter: brightness(0.7);
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Custom animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.feature-card, .product-card {
  animation: fadeInUp 0.6s ease;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .hero-content {
    padding: 0 16px;
  }
  
  .text-h2 {
    font-size: 2rem !important;
  }
  
  .text-h3 {
    font-size: 1.75rem !important;
  }
  
  .text-h4 {
    font-size: 1.5rem !important;
  }
  
  .gap-4 {
    gap: 12px;
  }
  
  .d-flex.flex-wrap {
    justify-content: center;
  }
}
</style>