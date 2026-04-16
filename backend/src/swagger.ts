import path from 'path';
import swaggerJSDoc from 'swagger-jsdoc';
import config from './config';

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'SnapZO Backend API',
    version: '1.0.0',
    description:
      'Pay-to-Interact social network on Mezo testnet using MUSD.\n\n' +
      '- **Pay-to-Unlock Posts**\n' +
      '- **Pay-to-Reply** (guaranteed reply or 24h refund)\n' +
      '- **Pay-to-Like** (smart micro-tipping)\n\n' +
      'Every interaction is verified on-chain by inspecting the supplied `txHash` ' +
      'against the MUSD ERC-20 contract on Mezo.',
    contact: { name: 'SnapZO', url: 'https://github.com/klepi21/SnapZO' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: `http://localhost:${config.port}`, description: 'Local dev' },
  ],
  tags: [
    { name: 'Health', description: 'Service liveness probes.' },
    { name: 'Posts', description: 'Create and read posts.' },
    { name: 'Feed', description: 'Public feed (locked previews + unlocked content).' },
    { name: 'Unlock', description: 'Pay-to-Unlock locked posts.' },
    { name: 'Tip', description: 'Pay-to-Like micro-tipping.' },
    { name: 'Reply', description: 'Pay-to-Reply with 24h refund guarantee.' },
    { name: 'Users', description: 'User profile + posts.' },
  ],
  components: {
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Invalid request' },
          details: { type: 'object', additionalProperties: true, nullable: true },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          walletAddress: { type: 'string', example: '0xabc...' },
          username: { type: 'string', nullable: true },
          bio: { type: 'string', nullable: true },
          profileImage: { type: 'string', nullable: true, description: 'IPFS CID' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Post: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          postId: { type: 'string', description: 'txHash or UUID' },
          creatorWallet: { type: 'string' },
          content: { type: 'string' },
          ipfsHash: { type: 'string', nullable: true },
          isLocked: { type: 'boolean' },
          unlockPrice: { type: 'number', example: 0.1 },
          blurImage: { type: 'string', nullable: true },
          totalTips: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      FeedItem: {
        allOf: [
          { $ref: '#/components/schemas/Post' },
          {
            type: 'object',
            properties: {
              unlockedByMe: {
                type: 'boolean',
                description: 'True when the requesting wallet has unlocked this post.',
              },
              tipCount: { type: 'integer' },
              replyCount: { type: 'integer' },
            },
          },
        ],
      },
      CreatePostRequest: {
        type: 'object',
        required: ['creatorWallet'],
        properties: {
          creatorWallet: { type: 'string', example: '0xabc...' },
          content: { type: 'string' },
          mediaBase64: {
            type: 'string',
            description: 'Optional base64 file body to upload to IPFS as the post media.',
          },
          mediaName: { type: 'string', example: 'photo.png' },
          mediaMimeType: { type: 'string', example: 'image/png' },
          blurImageBase64: {
            type: 'string',
            description: 'Optional base64 blurred preview body.',
          },
          isLocked: { type: 'boolean', default: true },
          unlockPrice: { type: 'number', example: 0.1 },
        },
      },
      Unlock: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          post: { type: 'string' },
          userWallet: { type: 'string' },
          amount: { type: 'number' },
          txHash: { type: 'string' },
          unlockedAt: { type: 'string', format: 'date-time' },
        },
      },
      UnlockRequest: {
        type: 'object',
        required: ['postId', 'userWallet', 'txHash', 'amount'],
        properties: {
          postId: { type: 'string' },
          userWallet: { type: 'string' },
          txHash: { type: 'string', example: '0x...' },
          amount: { type: 'number', example: 0.1 },
        },
      },
      Tip: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          post: { type: 'string' },
          fromWallet: { type: 'string' },
          amount: { type: 'number' },
          message: { type: 'string', nullable: true },
          txHash: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      TipRequest: {
        type: 'object',
        required: ['postId', 'fromWallet', 'amount', 'txHash'],
        properties: {
          postId: { type: 'string' },
          fromWallet: { type: 'string' },
          amount: { type: 'number', example: 0.01 },
          txHash: { type: 'string' },
          message: { type: 'string', nullable: true },
        },
      },
      Reply: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          post: { type: 'string' },
          requesterWallet: { type: 'string' },
          amount: { type: 'number' },
          txHash: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'responded', 'refunded'] },
          deadline: { type: 'string', format: 'date-time' },
          replyContent: { type: 'string', nullable: true },
          replyIpfsHash: { type: 'string', nullable: true },
          respondedAt: { type: 'string', format: 'date-time', nullable: true },
          refundTxHash: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ReplyRequestRequest: {
        type: 'object',
        required: ['postId', 'requesterWallet', 'amount', 'txHash'],
        properties: {
          postId: { type: 'string' },
          requesterWallet: { type: 'string' },
          amount: { type: 'number', example: 0.5 },
          txHash: { type: 'string' },
        },
      },
      ReplyRespondRequest: {
        type: 'object',
        required: ['replyId', 'creatorWallet', 'replyContent'],
        properties: {
          replyId: { type: 'string' },
          creatorWallet: { type: 'string' },
          replyContent: { type: 'string' },
          replyMediaBase64: { type: 'string', nullable: true },
          replyMediaName: { type: 'string', nullable: true },
          replyMediaMimeType: { type: 'string', nullable: true },
        },
      },
      ReplyRefundRequest: {
        type: 'object',
        required: ['replyId'],
        properties: {
          replyId: { type: 'string' },
        },
      },
      Health: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          uptimeSec: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
          mongo: { type: 'string', example: 'connected' },
          chainId: { type: 'integer', example: 31611 },
          escrow: { type: 'string', nullable: true },
        },
      },
    },
    responses: {
      BadRequest: {
        description: 'Invalid request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      Conflict: {
        description: 'Conflict (e.g. txHash already used)',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
  },
};

const options: swaggerJSDoc.Options = {
  definition: swaggerDefinition,
  // Match both .ts (dev with tsx) and .js (compiled output).
  apis: [
    path.join(__dirname, 'routes', '*.{ts,js}'),
    path.join(__dirname, 'controllers', '*.{ts,js}'),
  ],
};

const swaggerSpec = swaggerJSDoc(options);
export default swaggerSpec;
