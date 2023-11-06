import React, { useEffect } from 'react'
import { useMutation, useQuery } from 'react-apollo'
import { MaybeProduct } from 'vtex.product-context/react/ProductTypes'
import { FormattedCurrency } from 'vtex.format-currency'
import { useCssHandles } from 'vtex.css-handles'
import { useRuntime } from 'vtex.render-runtime'
import { formatpDomainUrl } from 'marca1.format-domains'
import { usePixel } from 'vtex.pixel-manager'

import ADD_TO_CART from '../../graphql/mutations/addToCart.gql'
import { useBykContext } from '../../hooks/useBykContext'
import useMarketingSessionParams from '../../hooks/useMarketingSessionParams'
import { getBrand } from '../../utils/getBrand'
import { Option } from '../../modules/assemblyOptions'
import GET_ORDERFORM from '../../graphql/query/getOrderForm.gql'

const CSS_HANDLES = [
  'bykSelecteds',
  'bykSelectedsContainer',
  'bykSelectedsHeader',
  'bykSelectedsQuantity',
  'bykSelectedsPrices',
  'bykSelectedsPrice',
  'bykSelectedsBoxesContainer',
  'bykSelectedsBox',
  'bykSelectedsBoxNumber',
  'bykSelectedsBoxImage',
  'bykSelectedsButtonContainer',
  'bykSelectedsButton',
  'bykSelectedsFooter',
  'bykSelectedsFooterMessage',
] as const

interface Props {
  coupon: string
  discountPercentage: number
  pluralSelectedText: string
  singularSelectedText: string
  footerMessage: string
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
interface AddToCartItem {
  id: number
  quantity: number
  seller: string
  index?: number
  options?: Option[]
}
export interface OrderForm {
  id: string
  items: Item[]
}
export interface OrderFormData {
  orderForm: OrderForm
}

function BykSelecteds({
  coupon,
  discountPercentage = 0.4,
  pluralSelectedText = 'elegidos',
  singularSelectedText = 'elegido',
  footerMessage = '*El {discountPercentage} dscto. aplicará si agregas los {quantityGroups} productos.',
}: Props) {
  const { account } = useRuntime()
  const { handles, withModifiers } = useCssHandles(CSS_HANDLES)
  const { utmParams, utmiParams } = useMarketingSessionParams()

  const { productsAdded } = useBykContext()

  const [groupIds, setGroupIds] = React.useState<number[]>([])

  const [addToCart] = useMutation(ADD_TO_CART)

  const { refetch } = useQuery<OrderFormData>(GET_ORDERFORM, {
    skip: true,
  })

  const { push } = usePixel()

  useEffect(() => {
    const groups = document.querySelectorAll(
      '.vtex-flex-layout-0-x-flexRow--build-your-kit-wrapper'
    )

    if (groups.length > 0) {
      setGroupIds(
        Array.from(groups).map(group => Number(group.id.replace('group-', '')))
      )
    }
  }, [])

  const finalFooterMessage = footerMessage
    .replace('{discountPercentage}', `${discountPercentage * 100}`)
    .replace('{quantityGroups}', `${groupIds.length}`)

  const getImageUrl = (id: string, product: MaybeProduct) => {
    // @ts-ignore
    const image = product?.items?.find(item => item.itemId === id)?.images?.[0]
    return image?.imageUrl ?? ''
  }

  const getNameProduct = (id: string, product: MaybeProduct) => {
    // @ts-ignore
    const name = product?.items?.find(item => item.itemId === id)?.name
    return name ?? ''
  }

  const getQuantitySelecteds = () => {
    return Object.keys(productsAdded).length
  }

  const getAccumulatedPrice = () => {
    return Object.keys(productsAdded).reduce((acc: number, curr: string) => {
      const { product } = productsAdded[Number(curr)] ?? {}

      return acc + (product?.priceRange?.sellingPrice?.lowPrice ?? 0)
    }, 0)
  }

  const isKitBuilded = groupIds.length <= Object.keys(productsAdded).length

  function getAddToCartItemWithCorrectQuantity(
    cartItem: AddToCartItem,
    orderFormItems: Item[]
  ): AddToCartItem {
    const sameItemInCart = orderFormItems?.find(
      i => i.id === String(cartItem.id)
    )

    if (!sameItemInCart) {
      return cartItem
    }

    return {
      ...cartItem,
      quantity: cartItem.quantity + sameItemInCart.quantity,
    }
  }

  const addTocartButtonHandler = async () => {
    console.log('Iniciando el proceso de agregar al carrito...');
    const response = await refetch()
    console.log('Datos del formulario de pedido actualizados', response);
    const { data: { orderForm: { items = [] } = {} } = {} } = response

    const selectedItems = Object.keys(productsAdded).map((key: string) => {
      const { infoCartProduct } = productsAdded[Number(key)] ?? {}
      return getAddToCartItemWithCorrectQuantity(infoCartProduct, items)
    })
    console.log('Productos seleccionados para agregar:', selectedItems);

    const addToCartItemsObject = {
      variables: {
        items: selectedItems,
        marketingData: {
          ...utmParams,
          ...utmiParams,
          ...(coupon ? { coupon } : {}),
        },
        allowedOutdatedData: ['paymentData'],
        salesChannel: '1',
      },
    }
    console.log('Ejecutando mutación para agregar al carrito con variables:', addToCartItemsObject);

    await addToCart(addToCartItemsObject)
    for (const key in productsAdded) {
      const { pixelEvent } = productsAdded[Number(key)] ?? {}
      console.log('Evento de píxel para el producto agregado:', pixelEvent);

      push(pixelEvent)
    }
    localStorage.removeItem(
      `byk-productsAdded-${window.location.hostname}${window.location.pathname}`
    )
    window.location.href = `${formatpDomainUrl(
      'checkout'
    )}/checkout#/cart`
  }

  return (
    <div className={handles.bykSelectedsContainer}>
      <div
        className={`${handles.bykSelecteds} ${withModifiers(
          'bykSelecteds',
          getBrand({ account })
        )}`}
      >
        <div className={handles.bykSelectedsHeader}>
          <span className={handles.bykSelectedsQuantity}>
            {getQuantitySelecteds()}{' '}
            {getQuantitySelecteds() === 1
              ? singularSelectedText
              : pluralSelectedText}{' '}
          </span>
          <div className={handles.bykSelectedsPrices}>
            <span
              className={`${handles.bykSelectedsPrice} ${
                isKitBuilded ? withModifiers('bykSelectedsPrice', 'dashed') : ''
              }`}
            >
              <FormattedCurrency value={getAccumulatedPrice()} />
              {!isKitBuilded && '*'}
            </span>
            {isKitBuilded && (
              <span
                className={`${handles.bykSelectedsPrice} ${
                  isKitBuilded
                    ? withModifiers('bykSelectedsPrice', 'highlited')
                    : ''
                }`}
              >
                <FormattedCurrency
                  value={getAccumulatedPrice() * (1 - discountPercentage)}
                />
                *
              </span>
            )}
          </div>
          {isKitBuilded && (
            <div
              className={withModifiers(
                'bykSelectedsButtonContainer',
                'desktop'
              )}
            >
              <button
                className={handles.bykSelectedsButton}
                onClick={addTocartButtonHandler}
              >
                Ir a la bolsa
              </button>
            </div>
          )}
          <div className={withModifiers('bykSelectedsFooter', 'desktop')}>
            <p className={handles.bykSelectedsFooterMessage}>
              {finalFooterMessage}
            </p>
          </div>
        </div>
        <div className={handles.bykSelectedsBoxesContainer}>
          {groupIds.map((groupId, idx) => {
            const { product, infoCartProduct } = productsAdded[groupId] ?? {}
            return (
              <div
                className={`${handles.bykSelectedsBox} ${
                  product ? withModifiers('bykSelectedsBox', 'filled') : ''
                }`}
                key={groupId}
              >
                {product ? (
                  <img
                    className={handles.bykSelectedsBoxImage}
                    width={48}
                    height={48}
                    src={getImageUrl(infoCartProduct.id.toString(), product)}
                    alt={getNameProduct(infoCartProduct.id.toString(), product)}
                  />
                ) : (
                  <span className={handles.bykSelectedsBoxNumber}>
                    {idx + 1}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {isKitBuilded && (
          <div
            className={withModifiers('bykSelectedsButtonContainer', 'mobile')}
          >
            <button
              className={handles.bykSelectedsButton}
              onClick={addTocartButtonHandler}
            >
              Ir a la bolsa
            </button>
          </div>
        )}
        <div className={withModifiers('bykSelectedsFooter', 'mobile')}>
          <p className={handles.bykSelectedsFooterMessage}>
            {finalFooterMessage}
          </p>
        </div>
      </div>
    </div>
  )
}

export default BykSelecteds

BykSelecteds.schema = {
  title: 'Build your kit Selecteds',
  description: 'Build your kit Selecteds options',
  type: 'object',
  properties: {
    coupon: {
      title: 'Cupón',
      description:
        'Define el cupón que se aplicará a la bolsa de compras. Ejemplo: UAT20',
      type: 'string',
    },
    discountPercentage: {
      title: 'Descuento',
      description: 'Define el descuent de la promoción. Ejemplo: 0.4',
      type: 'number',
      default: 0.4,
    },
    singularSelectedText: {
      title: 'Texto singular de seleccionados',
      description:
        'Define el texto en singular para los seleccionados. Ejemplo: Elegido',
      type: 'string',
      default: 'Elegido',
    },
    pluralSelectedText: {
      title: 'Texto plural de seleccionados',
      description:
        'Define el texto en plural para los seleccionados. Ejemplo: Elegidos',
      type: 'string',
      default: 'Elegidos',
    },
    footerMessage: {
      title: 'Mensaje del footer de Seleccionados',
      description:
        'Define el mensaje del footer de seleccionados. Si deseas mostrar el porcentaje de descuento y la cantidad de grupos puedes hacerlo de la siguiente manera: {discountPercentage} y {quantityGroups} respectivamente. Ejemplo: *El {discountPercentage} dscto. aplicará si agregas los {quantityGroups} productos.',
      type: 'string',
      default:
        '*El {discountPercentage} dscto. aplicará si agregas los {quantityGroups} productos.',
    },
  },
}
