import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { MaybeProduct } from 'vtex.product-context/react/ProductTypes'
import { useCssHandles } from 'vtex.css-handles'
import { useRuntime } from 'vtex.render-runtime'

import { Option } from '../../modules/assemblyOptions'
import { getBrand } from '../../utils/getBrand'

interface AddToCartItem {
  id: number
  quantity: number
  seller: string
  index?: number
  options?: Option[]
}

interface PixelEvent {
  id?: string
  event?: string
  items?: {
    [key: string]: any
  }
}

type BykContextType = {
  productsAdded: Record<
    number,
    {
      infoCartProduct: AddToCartItem
      product: MaybeProduct
      pixelEvent: PixelEvent
    }
  >
  addProduct: (params: {
    group: number
    infoCartProduct: AddToCartItem
    product: MaybeProduct
    pixelEvent: PixelEvent
  }) => void
}

export const BykContext = createContext<BykContextType>({
  productsAdded: {},
  addProduct: () => {},
})

const CSS_HANDLES = ['bykGroupSelected'] as const
const ByContextProvider = ({ children }: { children: React.ReactElement }) => {
  const { withModifiers } = useCssHandles(CSS_HANDLES)

  const [productsAdded, setProductsAdded] = useState<
    BykContextType['productsAdded']
  >({})

  const htmlGroups = useRef<HTMLDivElement[]>([])
  const { account } = useRuntime()

  const syncLocalStorage = useCallback(() => {
    localStorage.setItem(
      `byk-productsAdded-${window.location.hostname}${window.location.pathname}`,
      JSON.stringify(productsAdded)
    )
  }, [productsAdded])

  useEffect(() => {
    const productsAddedFromLocalStorage = localStorage.getItem(
      `byk-productsAdded-${window.location.hostname}${window.location.pathname}`
    )

    if (!productsAddedFromLocalStorage) return

    const parsedProductsAddedFromLocalStorage = JSON.parse(
      productsAddedFromLocalStorage
    )
    setProductsAdded(parsedProductsAddedFromLocalStorage)
    const parsedProductsAddedFromLocalStorageArray = Object.keys(
      parsedProductsAddedFromLocalStorage
    )

    setTimeout(() => {
      const nextGroup = document.getElementById(
        `group-${parsedProductsAddedFromLocalStorageArray?.length + 1}`
      ) as HTMLDivElement

      const nextGroupRect = nextGroup?.getBoundingClientRect()

      if (nextGroupRect?.top) {
        window.scrollTo({
          top: nextGroupRect.top + window.scrollY,
          behavior: 'smooth',
        })
      }

      if (
        parsedProductsAddedFromLocalStorageArray?.length > 0 &&
        parsedProductsAddedFromLocalStorageArray?.length ===
          document.querySelectorAll(
            '.vtex-flex-layout-0-x-flexRow--build-your-kit-wrapper'
          )?.length
      ) {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth',
        })
      }
    }, 2000)
  }, [])

  useEffect(() => {
    const groups = htmlGroups.current.length
      ? htmlGroups.current
      : (Array.from(
          document.querySelectorAll(
            '.vtex-flex-layout-0-x-flexRow--build-your-kit-wrapper'
          )
        ) as HTMLDivElement[])

    htmlGroups.current = groups

    for (const group of htmlGroups.current) {
      if (Object.keys(productsAdded).includes(group.id.replace('group-', ''))) {
        for (const modifier of withModifiers(
          'bykGroupSelected',
          getBrand({ account })
        ).split(' ')) {
          group?.classList?.add(modifier)
        }
      } else {
        for (const modifier of withModifiers(
          'bykGroupSelected',
          getBrand({ account })
        ).split(' ')) {
          group?.classList?.remove(modifier)
        }
      }
    }

    syncLocalStorage()
  }, [account, productsAdded, syncLocalStorage, withModifiers])

  const addProduct = ({
    group,
    product,
    infoCartProduct,
    pixelEvent,
  }: {
    group: number
    infoCartProduct: AddToCartItem
    product: MaybeProduct
    pixelEvent: PixelEvent
  }) => {
    setProductsAdded(prev => {
      return {
        ...prev,
        [group]: {
          infoCartProduct,
          product,
          pixelEvent,
        },
      }
    })
  }

  return (
    <BykContext.Provider
      value={{
        productsAdded,
        addProduct,
      }}
    >
      {children}
    </BykContext.Provider>
  )
}

export default ByContextProvider
