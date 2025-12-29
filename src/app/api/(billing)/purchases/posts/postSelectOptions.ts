const postSelectOptions = {
  id: true,
  createdAt: true,
  updatedAt: true,
  entityType: true,
  payment: {
    select: {
      id: true,
      provider: true,
      reference: true,
      paidAmount: true,
      status: true,
      paidAmountCurrency: true,
      createdAt: true,
    },
  },
  post: {
    select: {
      ID: true,
      post_name: true,
      post_status: true,
      post_excerpt: true,
      post_title: true,
      post_date: true,
      post_date_gmt: true,
      post_modified: true,
      post_modified_gmt: true,
      archived: true,
      archivedAt: true,
      termRelationships: {
        select: {
          taxonomy: {
            select: {
              taxonomy: true,
              count: true,
              description: true,
              term: {
                select: {
                  term_id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
      children: {
        select: {
          ID: true,
          guid: true,
          post_type: true,
          post_excerpt: true,
          post_mime_type: true,
          post_title: true,
          post_date: true,
          meta: {
            select: {
              meta_key: true,
              meta_value: true,
            },
          },
        },
      },
      meta: true,
      author: {
        select: {
          ID: true,
          display_name: true,
          user_nicename: true,
        },
      },
    },
  },
} as const;

export default postSelectOptions;
