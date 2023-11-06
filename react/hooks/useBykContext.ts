import { useContext } from 'react'

import { BykContext } from '../components/build-your-kit-provider'

export const useBykContext = () => useContext(BykContext)
