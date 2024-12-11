import DefaultTheme from 'vitepress/theme'
import HomeLayout from './HomeLayout.vue'
// import {EventLifecycle} from '../../components/event-lifecycle-diagram.vue'
import './custom.css'

export default {
    extends: DefaultTheme,
    // enhanceApp({ app }) {
    //     // register your custom global components
    //     app.component('EventLifecycle', EventLifecycle)
    // },
    // override the Layout with a wrapper component that
    // injects the slots
    Layout: HomeLayout,
}
