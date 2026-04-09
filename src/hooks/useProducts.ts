import { useState } from 'react'
import type { MutableRefObject } from 'react'
import { api } from '../api'
import type { Product, ProductDraft } from '../types'

interface Deps {
  isMutatingRef: MutableRefObject<boolean>
  requireActive: () => boolean
  billingPlan: string
  setIsUpgradeModalOpen: (open: boolean) => void
}

export function useProducts({ isMutatingRef, requireActive, billingPlan, setIsUpgradeModalOpen }: Deps) {
  const [products, setProducts] = useState<Product[]>([])
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [productDraft, setProductDraft] = useState<ProductDraft>({ name: '', price: 0 })

  const openAddProduct = () => {
    if (!requireActive()) return
    if ((billingPlan === 'trial' || billingPlan === 'solo') && products.length >= 1) {
      setIsUpgradeModalOpen(true)
      return
    }
    setEditingProductId(null)
    setProductDraft({ name: '', price: 0 })
    setIsProductModalOpen(true)
  }

  const openEditProduct = (product: Product) => {
    if (!requireActive()) return
    setEditingProductId(product.id)
    setProductDraft({ name: product.name, price: product.price })
    setIsProductModalOpen(true)
  }

  const closeProductModal = () => {
    setIsProductModalOpen(false)
    setEditingProductId(null)
  }

  const saveProduct = async () => {
    if (!productDraft.name.trim()) { alert('Product name is required.'); return }
    isMutatingRef.current = true
    try {
      if (editingProductId !== null) {
        await api.updateProduct(editingProductId, productDraft)
      } else {
        await api.createProduct(productDraft)
      }
      const fresh = await api.getProducts()
      setProducts(fresh)
      setIsProductModalOpen(false)
    } catch (error) {
      alert('Failed to save product. Please try again.')
      console.error('Failed to save product', error)
    } finally {
      isMutatingRef.current = false
    }
  }

  const handleDeleteProduct = async (id: number) => {
    const ok = window.confirm('Remove this product? This cannot be undone.')
    if (!ok) return
    isMutatingRef.current = true
    try {
      await api.deleteProduct(id)
      setProducts(prev => prev.filter(p => p.id !== id))
    } catch (error) {
      alert('Failed to delete product. Please try again.')
      console.error('Failed to delete product', error)
    } finally {
      isMutatingRef.current = false
    }
  }

  return {
    products,
    setProducts,
    isProductModalOpen,
    editingProductId,
    productDraft,
    setProductDraft,
    openAddProduct,
    openEditProduct,
    closeProductModal,
    saveProduct,
    handleDeleteProduct,
  }
}
