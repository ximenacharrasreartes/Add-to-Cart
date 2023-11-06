import React, { useState, useEffect, useRef } from 'react'
import { FormattedMessage, useIntl, defineMessages } from 'react-intl'
import { useLazyQuery } from 'react-apollo'
import { Button, Tooltip } from 'vtex.styleguide'
import { useCssHandles } from 'vtex.css-handles'
import { useRuntime } from 'vtex.render-runtime'
import { useProduct, useProductDispatch } from 'vtex.product-context'
import { useOrderForm } from 'vtex.order-manager/OrderForm'

import { CartItem } from '../../modules/catalogItemToCart'
import { Option } from '../../modules/assemblyOptions'
import GET_ORDERFORM from '../../graphql/query/getOrderForm.gql'
import { useBykContext } from '../../hooks/useBykContext'

interface ProductLink {
  linkText?: string
  productId?: string
}

interface AddToCartItem {
  id: number
  quantity: number
  seller: string
  index?: number
  options?: Option[]
}

interface Props {
  isOneClickBuy: boolean
  available: boolean
  disabled: boolean
  multipleAvailableSKUs: boolean
  customToastUrl?: string
  customOneClickBuyLink?: string
  skuItems: CartItem[]
  showToast: Function
  allSkuVariationsSelected: boolean
  text?: string
  unavailableText?: string
  productLink: ProductLink
  onClickBehavior: 'add-to-cart' | 'go-to-product-page' | 'ensure-sku-selection'
  customPixelEventId?: string
  addToCartFeedback?: 'customEvent' | 'toast'
  onClickEventPropagation: 'disabled' | 'enabled'
  isLoading?: boolean
}

export interface Item {
  id: string
  name: string
  productRefId: string
  productId: string
  quantity: number
  uniqueId: string
  refId: string
}

export interface OrderForm {
  id: string
  items: Item[]
}

export interface OrderFormData {
  orderForm: OrderForm
}

// We apply a fake loading to accidental consecutive clicks on the button
const FAKE_LOADING_DURATION = 500

function getFakeLoadingDuration(isOneClickBuy: boolean) {
  return isOneClickBuy ? FAKE_LOADING_DURATION * 10 : FAKE_LOADING_DURATION
}

const CSS_HANDLES = [
  'buttonText',
  'buttonDataContainer',
  'tooltipLabelText',
] as const

const messages = defineMessages({
  success: { id: 'store/add-to-cart.success' },
  duplicate: { id: 'store/add-to-cart.duplicate' },
  error: { id: 'store/add-to-cart.failure' },
  seeCart: { id: 'store/add-to-cart.see-cart' },
  skuVariations: {
    id: 'store/add-to-cart.select-sku-variations',
  },
  schemaTitle: { id: 'admin/editor.add-to-cart.title' },
  schemaTextTitle: { id: 'admin/editor.add-to-cart.text.title' },
  schemaTextDescription: { id: 'admin/editor.add-to-cart.text.description' },
  schemaUnavailableTextTitle: {
    id: 'admin/editor.add-to-cart.text-unavailable.title',
  },
  schemaUnavailableTextDescription: {
    id: 'admin/editor.add-to-cart.text-unavailable.description',
  },
})

const mapSkuItemForPixelEvent = (skuItem: CartItem) => {
  // Changes this `/Apparel & Accessories/Clothing/Tops/`
  // to this `Apparel & Accessories/Clothing/Tops`
  const category = skuItem.category ? skuItem.category.slice(1, -1) : ''

  return {
    skuId: skuItem.id,
    ean: skuItem.ean,
    variant: skuItem.variant,
    price: skuItem.price,
    sellingPrice: skuItem.sellingPrice,
    priceIsInt: true,
    name: skuItem.name,
    quantity: skuItem.quantity,
    productId: skuItem.productId,
    productRefId: skuItem.productRefId,
    brand: skuItem.brand,
    category,
    detailUrl: skuItem.detailUrl,
    imageUrl: skuItem.imageUrl,
    referenceId: skuItem?.referenceId?.[0]?.Value,
    seller: skuItem.seller,
    sellerName: skuItem.sellerName,
  }
}

function parseItemAddToCart(item: CartItem): AddToCartItem {
  return {
    id: Number(item.id),
    quantity: item.quantity,
    seller: item.seller,
    index: item.index,
    options: item.options,
  }
}

function ProductAddToCartButton(props: Props) {
  const {
    text,
    isOneClickBuy,
    available,
    disabled,
    skuItems,
    unavailableText,
    allSkuVariationsSelected = true,
    productLink,
    onClickBehavior,
    multipleAvailableSKUs,
    onClickEventPropagation = 'disabled',
    isLoading,
    customPixelEventId,
    addToCartFeedback,
  } = props

  const { product } = useProduct() ?? {}
  const intl = useIntl()
  const { handles } = useCssHandles(CSS_HANDLES)
  const [getOrderForm, { data: orderFormData }] = useLazyQuery(GET_ORDERFORM, {
    fetchPolicy: 'no-cache',
  })

  const { setOrderForm } = useOrderForm()
  const productContextDispatch = useProductDispatch()
  const { navigate } = useRuntime()
  const [isFakeLoading, setFakeLoading] = useState(false)

  // collect toast and fake loading delay timers
  const timers = useRef<Record<string, number | undefined>>({})

  // prevent timers from doing something if the component was unmounted
  useEffect(function onUnmount() {
    return () => {
      // We disable the eslint rule because we just want to clear the current existing timers
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(timers.current).forEach(clearTimeout)
    }
  }, [])

  useEffect(() => {
    const currentTimers = timers.current

    if (isFakeLoading) {
      currentTimers.loading = window.setTimeout(
        () => setFakeLoading(false),
        getFakeLoadingDuration(isOneClickBuy)
      )
    }
  }, [isFakeLoading, isOneClickBuy])

  useEffect(() => {
    if (!orderFormData) {
      return
    }

    const { orderForm: { items = [] } = {} } = orderFormData

    setOrderForm({ items })
  }, [orderFormData, setOrderForm])

  const { addProduct, productsAdded } = useBykContext()

  const handleAddToCart = async (event: React.MouseEvent) => {
    const parentElement = (event.target as HTMLButtonElement).closest(
      '.vtex-flex-layout-0-x-flexRow--build-your-kit-wrapper'
    )

    setFakeLoading(true)

    const productLinkIsValid = Boolean(
      productLink.linkText && productLink.productId
    )
    const shouldNavigateToProductPage =
      onClickBehavior === 'go-to-product-page' ||
      (onClickBehavior === 'ensure-sku-selection' && multipleAvailableSKUs)

    if (productLinkIsValid && shouldNavigateToProductPage) {
      navigate({
        page: 'store.product',
        params: {
          slug: productLink.linkText,
          id: productLink.productId,
        },
      })
      return
    }

    const pixelEventItems = skuItems.map(mapSkuItemForPixelEvent)
    const pixelEvent =
      customPixelEventId && addToCartFeedback === 'customEvent'
        ? {
            id: customPixelEventId,
            event: 'addToCart',
            items: pixelEventItems,
          }
        : {
            event: 'addToCart',
            items: pixelEventItems,
          }

    const [addToCartItem] = skuItems.map(parseItemAddToCart)

    const groupNumberFromId = Number(parentElement?.id?.replace('group-', ''))
    addProduct({
      group: parentElement?.id ? groupNumberFromId : 1,
      infoCartProduct: addToCartItem,
      product,
      pixelEvent,
    })

    window.setTimeout(() => {
      getOrderForm()

      const nextGroup = document.getElementById(
        `group-${groupNumberFromId + 1}`
      ) as HTMLDivElement

      const nextGroupRect = nextGroup?.getBoundingClientRect()

      if (nextGroupRect?.top) {
        window.scrollTo({
          top: nextGroupRect.top + window.scrollY,
          behavior: 'smooth',
        })
      }

      const productsAddedArray = Object.keys(productsAdded || {})
      if (
        productsAddedArray?.length > 0 &&
        productsAddedArray?.length + 1 >=
          document.querySelectorAll(
            '.vtex-flex-layout-0-x-flexRow--build-your-kit-wrapper'
          )?.length
      ) {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: 'smooth',
        })
      }
    }, FAKE_LOADING_DURATION * 2)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (productContextDispatch) {
      productContextDispatch({
        type: 'SET_BUY_BUTTON_CLICKED',
        args: { clicked: true },
      })
    }

    if (onClickEventPropagation === 'disabled') {
      e.preventDefault()
      e.stopPropagation()
    }

    if (allSkuVariationsSelected) {
      handleAddToCart(e)
    }
  }

  /*
   * If text is an empty string it should render the default message
   */
  const availableButtonContent = (
    <div className={`${handles.buttonDataContainer} flex justify-center`}>
      {text ? (
        <span className={handles.buttonText}>{text}</span>
      ) : (
        <FormattedMessage id="store/add-to-cart.add-to-cart">
          {message => <span className={handles.buttonText}>{message}</span>}
        </FormattedMessage>
      )}
    </div>
  )

  const unavailableButtonContent = unavailableText ? (
    <span className={handles.buttonText}>{unavailableText}</span>
  ) : (
    <FormattedMessage id="store/add-to-cart.label-unavailable">
      {message => <span className={handles.buttonText}>{message}</span>}
    </FormattedMessage>
  )

  const tooltipLabel = (
    <span className={handles.tooltipLabelText}>
      {intl.formatMessage(messages.skuVariations)}
    </span>
  )

  const ButtonWithLabel = (
    <Button
      block
      isLoading={isFakeLoading || isLoading}
      disabled={disabled || !available}
      onClick={handleClick}
    >
      {available ? availableButtonContent : unavailableButtonContent}
    </Button>
  )

  return allSkuVariationsSelected ? (
    ButtonWithLabel
  ) : (
    <Tooltip trigger="click" label={tooltipLabel}>
      {ButtonWithLabel}
    </Tooltip>
  )
}

export default ProductAddToCartButton
