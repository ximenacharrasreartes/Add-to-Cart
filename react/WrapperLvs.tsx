// @ts-ignore
import React from 'react'
import { useQuery } from 'react-apollo'
import { ProductContextProvider, ProductTypes } from 'vtex.product-context'
import { Product } from '@nizza/player'

import Wrapper, { Props } from './Wrapper'
import GET_PRODUCT from './graphql/query/getProduct.gql'

interface LvsProps extends Props {
  product: Product
  children: React.ReactChild
}

interface Variables {
  productId: string
}

interface Reponse {
  product: ProductTypes.Product
}

function WrapperLvs({ product, children, ...restProps }: LvsProps) {
  const { data: { product: productData } = {} } = useQuery<Reponse, Variables>(
    GET_PRODUCT,
    {
      variables: { productId: product.productId },
    }
  )
// @ts-ignore
  const availableItems = productData?.items.filter(item => {
    const availableSellers = item.sellers.filter(
      // @ts-ignore
      seller => seller.commertialOffer.AvailableQuantity > 0
    )

    return availableSellers.length > 0
  })

  const shouldOpenModal = availableItems && availableItems?.length > 1

  return (
    <ProductContextProvider product={productData} query={{}}>
      {shouldOpenModal ? children : <Wrapper {...restProps} />}
    </ProductContextProvider>
  )
}

export default WrapperLvs
