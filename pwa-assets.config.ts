import {
    defineConfig,
    type Preset,
} from '@vite-pwa/assets-generator/config'

const preset: Preset = {
    transparent: {
        sizes: [64, 192, 512],
        favicons: [[48, 'favicon.ico']],
        padding: 0,
    },
    maskable: {
        sizes: [512],
        padding: 0,
        resizeOptions: {
            background: '#f5f3ee',
        },
    },
    apple: {
        sizes: [180],
        padding: 0,
        resizeOptions: {
            background: '#f5f3ee',
        },
    },
}

export default defineConfig({
    headLinkOptions: {
        preset: '2023',
    },
    preset,
    images: ['public/logo.png'],
})
