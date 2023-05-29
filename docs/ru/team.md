---
layout: page
title: Встречайте команду
description: Разработкой Moost занимается один разработчик.
---

<script setup>
import {
  VPTeamPage,
  VPTeamPageTitle,
  VPTeamPageSection,
  VPTeamMembers
} from 'vitepress/theme'
const core = [{
    avatar: 'https://www.github.com/mav-rik.png',
    name: 'Артем Мальцев',
    title: 'Автор',
    // org: 'Booking.com',
    // orgLink: '',
    desc: 'Fullstack Software Engineer',
    links: [
      { icon: 'github', link: 'https://github.com/mav-rik' },
      { icon: 'twitter', link: 'https://twitter.com/MAVrik7' },
    ],
    // sponsor: 'https://github.com/sponsors/mav-rik',
  }]
</script>

<VPTeamPage>
  <VPTeamPageTitle>
    <template #title>Meet the Team</template>
    <template #lead>
      Разработкой Moost занимается один разработчик.
    </template>
  </VPTeamPageTitle>
  <VPTeamMembers :members="core" />
</VPTeamPage>
