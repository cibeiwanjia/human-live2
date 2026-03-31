import { ValueSlider } from "@/components/slider/valueSlider";
import { EngineParamDesc, PARAM_TYPE, VoiceDesc } from '@/lib/protocol';
import {
    Autocomplete,
    AutocompleteItem,
    Input,
    Skeleton
} from "@heroui/react";
import { memo } from 'react';
import VoiceSelector from "../selector/voiceSelector";

export function ParamsLoading() {
    return (
        <div className="space-y-3">
            <Skeleton className="max-w-xs rounded-lg">
            <div className="h-8 max-w-xs rounded-lg bg-default-200" />
            </Skeleton>
            <Skeleton className="max-w-xs rounded-lg">
            <div className="h-8 max-w-xs rounded-lg bg-default-200" />
            </Skeleton>
            <Skeleton className="max-w-xs rounded-lg">
            <div className="h-8 max-w-xs rounded-lg bg-default-300" />
            </Skeleton>
        </div>
    )
}

export const ParamsList = memo(({
    params,
    settings,
    setSettings
}: {
    params: EngineParamDesc[],
    settings: {[key: string]: any},
    setSettings: (settings: { [key: string]: any }) => void
}) => {
    return (
        <>
            {
                params.map((config: EngineParamDesc) => {
                    switch (config.type) {
                        // 字符串类型
                        case PARAM_TYPE.STRING:
                            // 增加安全校验：确保 choices 存在且长度大于 0
                            if (config.choices?.length > 0) {
                                // 可选字符串类型
                                return (
                                    config.name == 'voice' ?
                                    <VoiceSelector
                                        name={config.name}
                                        key={config.name}
                                        description={config.description}
                                        required={config.required}
                                        choices={config.choices as string[]}
                                        default={config.default as string}
                                    />
                                    :
                                    <Autocomplete
                                        className="max-w-md"
                                        isReadOnly={true}
                                        name={config.name}
                                        label={config.name}
                                        key={config.name}
                                        required={config.required}
                                        placeholder={config.description}
                                        selectedKey={settings[config.name] as string}
                                        onSelectionChange={
                                            (e: any) => {
                                                setSettings({ ...settings, [config.name]: e as string })
                                            }
                                        }
                                    >
                                        {
                                            // 增加安全校验
                                            config.choices.map((choice) => (
                                                <AutocompleteItem key={choice as string}>{choice}</AutocompleteItem>
                                            ))
                                        }
                                    </Autocomplete>
                                )
                            } else {
                                // 可输入字符串类型
                                return (
                                    <Input
                                        className="max-w-md"
                                        name={config.name}
                                        label={config.name}
                                        key={config.name}
                                        required={config.required}
                                        placeholder={config.description}
                                        value={settings[config.name] as string || ""} // 增加默认值防报错
                                        onValueChange={
                                            (value) => {
                                                setSettings({ ...settings, [config.name]: value as string })
                                            }
                                        }
                                    />
                                )
                            }
                        // 整数或浮点数类型
                        case PARAM_TYPE.INT:
                        case PARAM_TYPE.FLOAT:
                            // 增加安全校验：确保 range 存在且长度大于 0
                            if (config.range?.length > 0) {
                                return (
                                    <ValueSlider
                                        label={config.name}
                                        description={config.description}
                                        key={config.name} // 修复 key，最好用 name 而不是 description
                                        minValue={config.range[0] as number}
                                        maxValue={config.range[1] as number}
                                        defaultValue={config.default as number}
                                        step={config.type == PARAM_TYPE.INT ? 1 : 0.01}
                                        onChange={
                                            (value) => {
                                                setSettings({ ...settings, [config.name]: value as number })
                                            }
                                        }
                                    />
                                )
                            }
                            // 增加安全校验：确保 choices 存在且长度大于 0
                            if (config.choices?.length > 0) {
                                return (
                                    <Autocomplete
                                        className="max-w-xs"
                                        isReadOnly={true}
                                        name={config.name}
                                        label={config.name}
                                        key={config.name}
                                        required={config.required}
                                        placeholder={config.description}
                                        selectedKey={String(settings[config.name])} // 确保转为字符串处理
                                        onSelectionChange={
                                            (e: any) => {
                                                setSettings({ ...settings, [config.name]: e as string })
                                            }
                                        }
                                    >
                                        {
                                            config.choices.map((choice) => (
                                                <AutocompleteItem key={String(choice)}>{String(choice)}</AutocompleteItem>
                                            ))
                                        }
                                    </Autocomplete>
                                )
                            }
                            return null; // 如果既没有 range 也没有 choices，返回 null
                        // TODO: 布尔类型
                        case PARAM_TYPE.BOOL:
                            return null;
                        default:
                            return null;
                    }
                })
            }
        </>
    )
});