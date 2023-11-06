export const getBrand = ({ account }: { account: string }) => {
  if (account.includes('cyzone')) {
    return 'cyzone'
  }

  if (account.includes('lbel')) {
    return 'lbel'
  }

  return 'esika'
}
