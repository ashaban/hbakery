import { ref } from 'vue';

export default function useProjectHierarchy () {
  const hierarchies = ref([{
    name: 'Users',
    children: [],
    id: 'users',
  }]);
  const getHierarchySync = (level = 'subcomponent') => {
    fetch(`/settings/getHierarchysync?level=${level}`).then(response => {
      response.json().then(results => {
        hierarchies.value = results;
      });
    });
  };

  const getHierarchyAsync = (level = 'subcomponent') => {
    fetch('/settings/getHierarchyAsync?level=' + level).then(response => {
      response.json().then(results => {
        hierarchies.value = results;
      });
    });
  };

  const loadChildren = async item => {
    const id = item.id.split('-')[1]
    const res = await fetch(
      `/settings/getHierarchyAsync?parentType=${item.type}&parentId=${id}&level=${item.level}`
    );
    const children = await res.json();
    item.children = children;
  };

  return {
    getHierarchySync,
    getHierarchyAsync,
    loadChildren,
    hierarchies,
  };
}
