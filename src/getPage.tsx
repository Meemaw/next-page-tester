import React from 'react';
import { existsSync } from 'fs';
import getPageObject from './getPageObject';
import makePageElement from './makePageElement';
import NavigationProvider from './NavigationProvider';
import RouterProvider from './RouterProvider';
import { fetchRouteData } from './fetchData';
import {
  defaultNextRoot,
  findPagesDirectory,
  getPageExtensions,
} from './utils';
import type {
  Options,
  OptionsWithDefaults,
  ExtendedOptions,
  PageObject,
} from './commonTypes';

function validateOptions({ nextRoot, route }: OptionsWithDefaults) {
  if (!route.startsWith('/')) {
    throw new Error('[next page tester] "route" option should start with "/"');
  }

  if (!existsSync(nextRoot)) {
    throw new Error(
      '[next page tester] Cannot find "nextRoot" directory under: ${nextRoot}'
    );
  }
}

export default async function getPage({
  route,
  nextRoot = defaultNextRoot,
  req = (req) => req,
  res = (res) => res,
  router = (router) => router,
  useApp = true,
  useDocument = false,
}: Options): Promise<{ page: React.ReactElement }> {
  const optionsWithDefaults: OptionsWithDefaults = {
    route,
    nextRoot,
    req,
    res,
    router,
    useApp,
    useDocument,
  };
  validateOptions(optionsWithDefaults);

  const options: ExtendedOptions = {
    ...optionsWithDefaults,
    pagesDirectory: findPagesDirectory({ nextRoot }),
    pageExtensions: getPageExtensions({ nextRoot }),
  };
  // @TODO: Consider printing extended options value behind a debug flag

  const makePage = async (
    optionsOverride?: Partial<ExtendedOptions>
  ): Promise<{ pageElement: JSX.Element; pageObject: PageObject }> => {
    const mergedOptions = { ...options, ...optionsOverride };

    const pageObject = await getPageObject({
      options: mergedOptions,
    });

    const pageData = await fetchRouteData({
      pageObject,
      options: mergedOptions,
    });

    if (pageData.redirect) {
      return makePage({
        ...mergedOptions,
        route: pageData.redirect.destination,
      });
    }

    const pageElement = await makePageElement({
      pageObject,
      options: mergedOptions,
      pageData,
    });

    return { pageElement, pageObject };
  };

  const { pageElement, pageObject } = await makePage();
  let previousRoute = route;

  return {
    page: (
      <RouterProvider pageObject={pageObject} options={options}>
        <NavigationProvider
          makePage={async (route) => {
            const { pageElement } = await makePage({
              route,
              previousRoute,
              isClientSideNavigation: true,
            });
            previousRoute = route;
            return pageElement;
          }}
        >
          {pageElement}
        </NavigationProvider>
      </RouterProvider>
    ),
  };
}
