function createQueryChain(data = null) {
  const result = Promise.resolve({ data, error: null })
  const chain = {
    select() {
      return chain
    },
    order() {
      return chain
    },
    limit() {
      return chain
    },
    eq() {
      return chain
    },
    insert() {
      return chain
    },
    update() {
      return chain
    },
    upsert() {
      return chain
    },
    maybeSingle() {
      return result
    },
    single() {
      return result
    },
  }
  return chain
}

export const supabase = {
  from() {
    return createQueryChain()
  },
  channel() {
    return {
      on() {
        return this
      },
      subscribe() {
        return { unsubscribe() {} }
      },
    }
  },
}
