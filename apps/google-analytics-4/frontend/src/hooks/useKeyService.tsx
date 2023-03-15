import { useCallback, useState, useEffect } from 'react';
import { AppExtensionSDK, AppState } from '@contentful/app-sdk';
import { useSDK } from '@contentful/react-apps-toolkit';
import { ContentTypeProps, createClient } from 'contentful-management';
import {
  AppInstallationParameters,
  ServiceAccountKey,
  ServiceAccountKeyId,
  ContentTypes,
  ContentTypeValue,
  AllContentTypes,
  AllContentTypeEntries,
} from 'types';
import {
  convertServiceAccountKeyToServiceAccountKeyId,
  convertKeyFileToServiceAccountKey,
  AssertionError,
} from 'utils/serviceAccountKey';
import {
  assignAppToContentTypeSidebar,
  syncContentTypes,
  sortAndFormatContentTypes,
} from 'utils/contentTypes';

interface KeyServiceInfoType {
  parameters: AppInstallationParameters;
  serviceAccountKeyFile: string;
  serviceAccountKeyFileErrorMessage: string;
  serviceAccountKeyFileIsValid: boolean;
  serviceAccountKeyFileIsRequired: boolean;
  contentTypes: ContentTypes;
  loadingParameters: boolean;
  allContentTypes: AllContentTypes;
  allContentTypeEntries: AllContentTypeEntries;
  loadingAllContentTypes: boolean;
  handleKeyFileChange: Function;
  handleContentTypeChange: (prevKey: string, newKey: string) => void;
  handleContentTypeFieldChange: (key: string, field: string, value: string) => void;
  handleAddContentType: () => void;
  handleRemoveContentType: (key: string) => void;
  handlePropertyChange: Function;
}

interface Props {
  onSaveGoogleAccountDetails?: Function; // Need this to switch the service account card view to display mode
}

export default function useKeyService(props: Props): KeyServiceInfoType {
  const { onSaveGoogleAccountDetails } = props;

  const [parameters, setParameters] = useState<AppInstallationParameters>(
    {} as AppInstallationParameters
  );
  const [newServiceAccountKey, setNewServiceAccountKey] = useState<ServiceAccountKey>();
  const [newServiceAccountKeyId, setNewServiceAccountKeyId] = useState<ServiceAccountKeyId>();
  const [serviceAccountKeyFile, setServiceAccountKeyFile] = useState<string>('');
  const [serviceAccountKeyFileErrorMessage, setServiceAccountKeyFileErrorMessage] =
    useState<string>('');
  const [serviceAccountKeyFileIsValid, setServiceAccountKeyFileIsValid] = useState<boolean>(true);
  const [serviceAccountKeyFileIsRequired, setServiceAccountKeyFileIsRequired] =
    useState<boolean>(false);
  const [savedPropertyId, setSavedPropertyId] = useState<string>('');

  const [contentTypes, setContentTypes] = useState<ContentTypes>({} as ContentTypes);
  const [loadingContentTypes, setLoadingContentTypes] = useState<boolean>(true);
  const [allContentTypes, setAllContentTypes] = useState<AllContentTypes>({} as AllContentTypes);
  const [allContentTypeEntries, setAllContentTypeEntries] = useState<AllContentTypeEntries>(
    [] as AllContentTypeEntries
  );
  const [loadingAllContentTypes, setLoadingAllContentTypes] = useState<boolean>(true);

  const sdk = useSDK<AppExtensionSDK>();

  const onConfigure = useCallback(async () => {
    const currentState = await sdk.app.getCurrentState();
    const contentTypeKeys = Object.keys(contentTypes);

    if (!serviceAccountKeyFileIsValid) {
      sdk.notifier.error('Invalid service account key file. See field error for details');
      return false;
    }

    if (serviceAccountKeyFileIsRequired && !newServiceAccountKeyId) {
      sdk.notifier.error('A valid service account key file is required');
      return false;
    }

    if (contentTypeKeys.some((key) => !key)) {
      sdk.notifier.error('Please complete or remove the incomplete content type rows');
      return false;
    }

    const newInstallationParameters = {
      serviceAccountKey: newServiceAccountKey ?? parameters.serviceAccountKey,
      serviceAccountKeyId: newServiceAccountKeyId ?? parameters.serviceAccountKeyId,
      contentTypes: contentTypes,
      savedPropertyId: savedPropertyId,
    };

    setParameters(newInstallationParameters);
    if (onSaveGoogleAccountDetails) onSaveGoogleAccountDetails();
    setServiceAccountKeyFileIsRequired(false);
    setServiceAccountKeyFile('');

    const sidebarAssignments = assignAppToContentTypeSidebar(contentTypeKeys, 1);

    const newAppState: AppState = {
      EditorInterface: {
        ...currentState?.EditorInterface,
        ...sidebarAssignments,
      },
    };

    return {
      parameters: newInstallationParameters,
      targetState: newAppState,
    };
  }, [
    contentTypes,
    newServiceAccountKey,
    newServiceAccountKeyId,
    onSaveGoogleAccountDetails,
    parameters.serviceAccountKey,
    parameters.serviceAccountKeyId,
    savedPropertyId,
    sdk.app,
    sdk.notifier,
    serviceAccountKeyFileIsRequired,
    serviceAccountKeyFileIsValid,
  ]);

  useEffect(() => {
    sdk.app.onConfigure(() => onConfigure());
  }, [sdk, onConfigure]);

  useEffect(() => {
    const setupAppInstallationParameters = async () => {
      const currentParameters: AppInstallationParameters =
        (await sdk.app.getParameters()) ?? ({} as AppInstallationParameters);

      if (currentParameters) {
        setParameters(currentParameters);
        setServiceAccountKeyFileIsRequired(false);
      } else {
        // per the documentation, `null` means app is not installed, thus we will require
        // the key file
        setServiceAccountKeyFileIsRequired(true);
      }

      if (currentParameters?.contentTypes) {
        const cma = createClient({ apiAdapter: sdk.cmaAdapter });
        const space = await cma.getSpace(sdk.ids.space);
        const environment = await space.getEnvironment(sdk.ids.environment);
        const contentTypes = await environment.getContentTypes();
        const currentState = await sdk.app.getCurrentState();

        const contentTypeItems = contentTypes.items as ContentTypeProps[];
        const allContentTypeItems = sortAndFormatContentTypes(contentTypeItems);
        setAllContentTypes(allContentTypeItems);
        setAllContentTypeEntries(Object.entries(allContentTypeItems));
        setLoadingAllContentTypes(false);

        const editorInterfaceResponse = currentState?.EditorInterface ?? {};
        const updatedContentTypes = syncContentTypes(
          currentParameters.contentTypes,
          allContentTypeItems,
          editorInterfaceResponse
        );

        setContentTypes(updatedContentTypes);
        setLoadingContentTypes(false);
      }

      sdk.app.setReady();
    };

    setupAppInstallationParameters();
  }, [sdk]);

  const handleValidServiceAccountKey = (newServiceAccountKey: ServiceAccountKey | undefined) => {
    setNewServiceAccountKey(newServiceAccountKey);
    setNewServiceAccountKeyId(
      newServiceAccountKey
        ? convertServiceAccountKeyToServiceAccountKeyId(newServiceAccountKey)
        : undefined
    );
    setServiceAccountKeyFileErrorMessage('');
    setServiceAccountKeyFileIsValid(true);
  };

  const handleInvalidServiceAccountKey = (errorMessage: string) => {
    setNewServiceAccountKey(undefined);
    setNewServiceAccountKeyId(undefined);
    setServiceAccountKeyFileErrorMessage(errorMessage);
    setServiceAccountKeyFileIsValid(false);
  };

  const handlePropertyChange = (_selectedPropertyId: string) => {
    setSavedPropertyId(_selectedPropertyId);
  };

  const handleKeyFileChange = (keyFile: string) => {
    setServiceAccountKeyFile(keyFile);

    const trimmedFieldValue = keyFile;
    if (trimmedFieldValue === '') {
      handleValidServiceAccountKey(undefined);
      return;
    }

    try {
      const newServiceAccountKey = convertKeyFileToServiceAccountKey(trimmedFieldValue);
      handleValidServiceAccountKey(newServiceAccountKey);
    } catch (e) {
      // failed assertions about key file contents or could not parse as JSON
      if (e instanceof AssertionError || e instanceof SyntaxError) {
        handleInvalidServiceAccountKey(e.message);
      } else {
        console.error(e);
        handleInvalidServiceAccountKey('An unknown error occurred');
      }
    }
  };

  const handleContentTypeChange = (prevKey: string, newKey: string) => {
    const newContentTypes: ContentTypes = {};

    for (const [prop, value] of Object.entries(contentTypes)) {
      if (prop === prevKey) {
        newContentTypes[newKey as keyof typeof contentTypes] = {
          slugField: '',
          urlPrefix: value.urlPrefix,
        };
      } else {
        newContentTypes[prop] = value;
      }
    }

    setContentTypes(newContentTypes);
  };

  const handleContentTypeFieldChange = (key: string, field: string, value: string) => {
    const currentContentTypeFields: ContentTypeValue = contentTypes[key];

    setContentTypes({
      ...contentTypes,
      [key]: {
        ...currentContentTypeFields,
        [field]: value,
      },
    });
  };

  const handleAddContentType = () => {
    setContentTypes({
      ...contentTypes,
      '': { slugField: '', urlPrefix: '' },
    });
  };

  const handleRemoveContentType = (key: string) => {
    const updatedContentTypes = { ...contentTypes };
    delete updatedContentTypes[key];

    setContentTypes(updatedContentTypes);
  };

  return {
    parameters,
    serviceAccountKeyFile,
    serviceAccountKeyFileErrorMessage,
    serviceAccountKeyFileIsValid,
    serviceAccountKeyFileIsRequired,
    contentTypes,
    loadingParameters: loadingContentTypes,
    allContentTypes,
    allContentTypeEntries,
    loadingAllContentTypes,
    handleKeyFileChange,
    handleContentTypeChange,
    handleContentTypeFieldChange,
    handleAddContentType,
    handleRemoveContentType,
    handlePropertyChange,
  };
}
