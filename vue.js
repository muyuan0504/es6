/*
 * @Date: 2022-03-02 17:14:09
 * @LastEditors: jimouspeng
 * @Description: Vue源码解读
 * @LastEditTime: 2022-03-07 11:28:00
 * @FilePath: \es6\vue.js
 */

/**
 * Vue 2.x实例化调用链
 * initMixin -> stateMixin -> eventsMixin -> lifecycleMixin -> renderMixin
 * new Vue -> this._init(options)
 */

function Vue(options) {
    if (process.env.NODE_ENV !== 'production' && !(this instanceof Vue)) {
        warn('Vue is a constructor and should be called with the `new` keyword')
    }
    this._init(options)
}

/** 为vue原型挂载_init方法
 * Vue挂载属性：
 * $options -> 初始化options实例配置
 * _renderProxy -> 指向this(Vue || 实例)
 * _self -> 指向this
 * isVue -> true
 * _uid -> uid++
 *
 */
initMixin(Vue)
function initMixin(Vue) {
    Vue.prototype._init = function (options?: Object) {
        const vm = this
        vm._uid = uid++ // a uid
        vm._isVue = true // a flag to avoid this being observed
        // merge options
        if (options && options._isComponent) {
            // optimize internal component instantiation
            // since dynamic options merging is pretty slow, and none of the
            // internal component options needs special treatment.
            initInternalComponent(vm, options)
        } else {
            vm.$options = mergeOptions(resolveConstructorOptions(vm.constructor), options || {}, vm)
        }
        vm._renderProxy = vm
        vm._self = vm // expose real self
        initLifecycle(vm)
        function initLifecycle(vm) {
            const options = vm.$options
            // locate first non-abstract parent
            let parent = options.parent
            if (parent && !options.abstract) {
                while (parent.$options.abstract && parent.$parent) {
                    parent = parent.$parent
                }
                parent.$children.push(vm)
            }

            vm.$parent = parent
            vm.$root = parent ? parent.$root : vm

            vm.$children = []
            vm.$refs = {}

            vm._watcher = null
            vm._inactive = null
            vm._directInactive = false
            vm._isMounted = false
            vm._isDestroyed = false
            vm._isBeingDestroyed = false
        }
        initEvents(vm)
        function initEvents(vm) {
            vm._events = Object.create(null)
            vm._hasHookEvent = false
            // init parent attached events
            const listeners = vm.$options._parentListeners
            if (listeners) {
                updateComponentListeners(vm, listeners)
            }
            function updateComponentListeners(vm: Component, listeners: Object, oldListeners: ?Object) {
                target = vm
                updateListeners(listeners, oldListeners || {}, add, remove, createOnceHandler, vm)
                target = undefined
            }
            function updateListeners(on: Object, oldOn: Object, add: Function, remove: Function, createOnceHandler: Function, vm: Component) {
                let name, def, cur, old, event
                for (name in on) {
                    def = cur = on[name]
                    old = oldOn[name]
                    event = normalizeEvent(name)
                    /* istanbul ignore if */
                    if (__WEEX__ && isPlainObject(def)) {
                        cur = def.handler
                        event.params = def.params
                    }
                    if (isUndef(cur)) {
                        process.env.NODE_ENV !== 'production' && warn(`Invalid handler for event "${event.name}": got ` + String(cur), vm)
                    } else if (isUndef(old)) {
                        if (isUndef(cur.fns)) {
                            cur = on[name] = createFnInvoker(cur, vm)
                        }
                        if (isTrue(event.once)) {
                            cur = on[name] = createOnceHandler(event.name, cur, event.capture)
                        }
                        add(event.name, cur, event.capture, event.passive, event.params)
                    } else if (cur !== old) {
                        old.fns = cur
                        on[name] = old
                    }
                }
                for (name in oldOn) {
                    if (isUndef(on[name])) {
                        event = normalizeEvent(name)
                        remove(event.name, oldOn[name], event.capture)
                    }
                }
            }
        }
        initRender(vm)
        function initRender(vm) {
            vm._vnode = null // the root of the child tree
            vm._staticTrees = null // v-once cached trees
            const options = vm.$options
            const parentVnode = (vm.$vnode = options._parentVnode) // the placeholder node in parent tree
            const renderContext = parentVnode && parentVnode.context
            vm.$slots = resolveSlots(options._renderChildren, renderContext)
            vm.$scopedSlots = emptyObject
            // bind the createElement fn to this instance
            // so that we get proper render context inside it.
            // args order: tag, data, children, normalizationType, alwaysNormalize
            // internal version is used by render functions compiled from templates
            vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
            // normalization is always applied for the public version, used in
            // user-written render functions.
            vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

            // $attrs & $listeners are exposed for easier HOC creation.
            // they need to be reactive so that HOCs using them are always updated
            const parentData = parentVnode && parentVnode.data

            /* istanbul ignore else */
            if (process.env.NODE_ENV !== 'production') {
                defineReactive(
                    vm,
                    '$attrs',
                    (parentData && parentData.attrs) || emptyObject,
                    () => {
                        !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
                    },
                    true
                )
                defineReactive(
                    vm,
                    '$listeners',
                    options._parentListeners || emptyObject,
                    () => {
                        !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
                    },
                    true
                )
            } else {
                defineReactive(vm, '$attrs', (parentData && parentData.attrs) || emptyObject, null, true)
                defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
            }
        }
        callHook(vm, 'beforeCreate')
        function callHook(vm, hook: string) {
            // #7573 disable dep collection when invoking lifecycle hooks
            pushTarget()
            const handlers = vm.$options[hook]
            const info = `${hook} hook`
            if (handlers) {
                for (let i = 0, j = handlers.length; i < j; i++) {
                    invokeWithErrorHandling(handlers[i], vm, null, vm, info)
                }
            }
            if (vm._hasHookEvent) {
                vm.$emit('hook:' + hook)
            }
            popTarget()
        }
        initInjections(vm) // resolve injections before data/props
        function initInjections(vm) {
            const result = resolveInject(vm.$options.inject, vm)
            if (result) {
                toggleObserving(false)
                Object.keys(result).forEach((key) => {
                    /* istanbul ignore else */
                    if (process.env.NODE_ENV !== 'production') {
                        defineReactive(vm, key, result[key], () => {
                            warn(
                                `Avoid mutating an injected value directly since the changes will be ` +
                                    `overwritten whenever the provided component re-renders. ` +
                                    `injection being mutated: "${key}"`,
                                vm
                            )
                        })
                    } else {
                        defineReactive(vm, key, result[key])
                    }
                })
                toggleObserving(true)
            }
        }
        initState(vm)
        function initState(vm) {
            vm._watchers = []
            const opts = vm.$options
            if (opts.props) initProps(vm, opts.props)
            if (opts.methods) initMethods(vm, opts.methods)
            if (opts.data) {
                initData(vm)
            } else {
                observe((vm._data = {}), true /* asRootData */)
            }
            if (opts.computed) initComputed(vm, opts.computed)
            if (opts.watch && opts.watch !== nativeWatch) {
                initWatch(vm, opts.watch)
            }
            function initProps(vm, propsOptions) {
                const propsData = vm.$options.propsData || {}
                const props = (vm._props = {})
                // cache prop keys so that future props updates can iterate using Array
                // instead of dynamic object key enumeration.
                const keys = (vm.$options._propKeys = [])
                const isRoot = !vm.$parent
                // root instance props should be converted
                if (!isRoot) {
                    toggleObserving(false)
                }
                for (const key in propsOptions) {
                    keys.push(key)
                    const value = validateProp(key, propsOptions, propsData, vm)
                    /* istanbul ignore else */
                    if (process.env.NODE_ENV !== 'production') {
                        const hyphenatedKey = hyphenate(key)
                        if (isReservedAttribute(hyphenatedKey) || config.isReservedAttr(hyphenatedKey)) {
                            warn(`"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`, vm)
                        }
                        defineReactive(props, key, value, () => {
                            if (!isRoot && !isUpdatingChildComponent) {
                                warn(
                                    `Avoid mutating a prop directly since the value will be ` +
                                        `overwritten whenever the parent component re-renders. ` +
                                        `Instead, use a data or computed property based on the prop's ` +
                                        `value. Prop being mutated: "${key}"`,
                                    vm
                                )
                            }
                        })
                    } else {
                        defineReactive(props, key, value)
                    }
                    // static props are already proxied on the component's prototype
                    // during Vue.extend(). We only need to proxy props defined at
                    // instantiation here.
                    if (!(key in vm)) {
                        proxy(vm, `_props`, key)
                    }
                }
                toggleObserving(true)
            }
        }
        initProvide(vm) // resolve provide after data/props
        function initProvide(vm) {
            const provide = vm.$options.provide
            if (provide) {
                vm._provided = typeof provide === 'function' ? provide.call(vm) : provide
            }
        }
        callHook(vm, 'created')
        if (vm.$options.el) {
            vm.$mount(vm.$options.el)
        }
    }
}

/**
 * 为vue原型挂载$data, $props属性，并使用set/get取值
 * 为vue原型挂载$set,$delete方法，$set: 设置响应式数据， $delete:删除对应响应式数据
 * 为vue原型挂载$watch方法，注册callback, 用于监听数据变动
 *
 */
stateMixin(Vue)
function stateMixin(Vue) {
    const dataDef = {}
    dataDef.get = function () {
        return this._data
    }
    const propsDef = {}
    propsDef.get = function () {
        return this._props
    }
    if (process.env.NODE_ENV !== 'production') {
        dataDef.set = function () {
            warn('Avoid replacing instance root $data. ' + 'Use nested data properties instead.', this)
        }
        propsDef.set = function () {
            warn(`$props is readonly.`, this)
        }
    }
    Object.defineProperty(Vue.prototype, '$data', dataDef)
    Object.defineProperty(Vue.prototype, '$props', propsDef)
    Vue.prototype.$set = set
    function set(target: Array<any> | Object, key: any, val: any): any {
        if (process.env.NODE_ENV !== 'production' && (isUndef(target) || isPrimitive(target))) {
            warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
        }
        if (Array.isArray(target) && isValidArrayIndex(key)) {
            target.length = Math.max(target.length, key)
            target.splice(key, 1, val)
            return val
        }
        if (key in target && !(key in Object.prototype)) {
            target[key] = val
            return val
        }
        const ob = (target: any).__ob__
        if (target._isVue || (ob && ob.vmCount)) {
            process.env.NODE_ENV !== 'production' &&
                warn('Avoid adding reactive properties to a Vue instance or its root $data ' + 'at runtime - declare it upfront in the data option.')
            return val
        }
        if (!ob) {
            target[key] = val
            return val
        }
        defineReactive(ob.value, key, val)
        function defineReactive(obj: Object, key: string, val: any, customSetter?: ?Function, shallow?: boolean) {
            const dep = new Dep()

            const property = Object.getOwnPropertyDescriptor(obj, key)
            if (property && property.configurable === false) {
                return
            }

            // cater for pre-defined getter/setters
            const getter = property && property.get
            const setter = property && property.set
            if ((!getter || setter) && arguments.length === 2) {
                val = obj[key]
            }

            let childOb = !shallow && observe(val)
            Object.defineProperty(obj, key, {
                enumerable: true,
                configurable: true,
                get: function reactiveGetter() {
                    const value = getter ? getter.call(obj) : val
                    if (Dep.target) {
                        dep.depend()
                        if (childOb) {
                            childOb.dep.depend()
                            if (Array.isArray(value)) {
                                dependArray(value)
                            }
                        }
                    }
                    return value
                },
                set: function reactiveSetter(newVal) {
                    const value = getter ? getter.call(obj) : val
                    /* eslint-disable no-self-compare */
                    if (newVal === value || (newVal !== newVal && value !== value)) {
                        return
                    }
                    /* eslint-enable no-self-compare */
                    if (process.env.NODE_ENV !== 'production' && customSetter) {
                        customSetter()
                    }
                    // #7981: for accessor properties without setter
                    if (getter && !setter) return
                    if (setter) {
                        setter.call(obj, newVal)
                    } else {
                        val = newVal
                    }
                    childOb = !shallow && observe(newVal)
                    dep.notify()
                },
            })
        }
        ob.dep.notify()
        return val
    }
    Vue.prototype.$delete = del
    function del(target: Array<any> | Object, key: any) {
        if (process.env.NODE_ENV !== 'production' && (isUndef(target) || isPrimitive(target))) {
            warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
        }
        if (Array.isArray(target) && isValidArrayIndex(key)) {
            target.splice(key, 1)
            return
        }
        const ob = (target: any).__ob__
        if (target._isVue || (ob && ob.vmCount)) {
            process.env.NODE_ENV !== 'production' && warn('Avoid deleting properties on a Vue instance or its root $data ' + '- just set it to null.')
            return
        }
        if (!hasOwn(target, key)) {
            return
        }
        delete target[key]
        if (!ob) {
            return
        }
        ob.dep.notify()
    }
    Vue.prototype.$watch = function (expOrFn: string | Function, cb: any, options?: Object): Function {
        const vm = this
        if (isPlainObject(cb)) {
            return createWatcher(vm, expOrFn, cb, options)
        }
        options = options || {}
        options.user = true
        const watcher = new Watcher(vm, expOrFn, cb, options)
        if (options.immediate) {
            const info = `callback for immediate watcher "${watcher.expression}"`
            pushTarget()
            invokeWithErrorHandling(cb, vm, [watcher.value], vm, info)
            popTarget()
        }
        return function unwatchFn() {
            watcher.teardown()
        }
    }
}

/**
 * 为Vue原型挂载$on,$once,$off,$emit事件订阅API
 * $on(event, cb) -> vm._events[event].push(cb)
 * $off -> vm._events[event] = null
 */
eventsMixin(Vue)
function eventsMixin(Vue) {
    const hookRE = /^hook:/
    Vue.prototype.$on = function (event: string | Array<string>, fn: Function) {
        const vm = this
        if (Array.isArray(event)) {
            for (let i = 0, l = event.length; i < l; i++) {
                vm.$on(event[i], fn)
            }
        } else {
            ;(vm._events[event] || (vm._events[event] = [])).push(fn)
            // optimize hook:event cost by using a boolean flag marked at registration
            // instead of a hash lookup
            if (hookRE.test(event)) {
                vm._hasHookEvent = true
            }
        }
        return vm
    }
    Vue.prototype.$once = function (event: string, fn: Function) {
        const vm = this
        function on() {
            vm.$off(event, on)
            fn.apply(vm, arguments)
        }
        on.fn = fn
        vm.$on(event, on)
        return vm
    }
    Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function) {
        const vm = this
        // all
        if (!arguments.length) {
            vm._events = Object.create(null)
            return vm
        }
        // array of events
        if (Array.isArray(event)) {
            for (let i = 0, l = event.length; i < l; i++) {
                vm.$off(event[i], fn)
            }
            return vm
        }
        // specific event
        const cbs = vm._events[event]
        if (!cbs) {
            return vm
        }
        if (!fn) {
            vm._events[event] = null
            return vm
        }
        // specific handler
        let cb
        let i = cbs.length
        while (i--) {
            cb = cbs[i]
            if (cb === fn || cb.fn === fn) {
                cbs.splice(i, 1)
                break
            }
        }
        return vm
    }
    Vue.prototype.$emit = function (event: string) {
        const vm = this
        if (process.env.NODE_ENV !== 'production') {
            const lowerCaseEvent = event.toLowerCase()
            if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
                tip(
                    `Event "${lowerCaseEvent}" is emitted in component ` +
                        `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
                        `Note that HTML attributes are case-insensitive and you cannot use ` +
                        `v-on to listen to camelCase events when using in-DOM templates. ` +
                        `You should probably use "${hyphenate(event)}" instead of "${event}".`
                )
            }
        }
        let cbs = vm._events[event]
        if (cbs) {
            cbs = cbs.length > 1 ? toArray(cbs) : cbs
            const args = toArray(arguments, 1)
            const info = `event handler for "${event}"`
            for (let i = 0, l = cbs.length; i < l; i++) {
                invokeWithErrorHandling(cbs[i], vm, args, vm, info)
            }
        }
        return vm
    }
}

/**
 * 声明周期相关操作
 * 为Vue原型挂载_update,$forceUpdate,$destory方法
 * _update(vnode, hydrating)
 * $forceUpdate -> vm._watcher.update()
 * $destroy ->
 * 强制完全销毁一个实例。清理它与其它实例的连接，解绑它的全部指令及事件监听器, 包括Watcher对象从其所在Dep中释放,不会改变页面已渲染DOM
 */
lifecycleMixin(Vue)
function lifecycleMixin(Vue) {
    let activeInstance = null
    Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
        const vm = this
        const prevEl = vm.$el
        const prevVnode = vm._vnode
        const restoreActiveInstance = setActiveInstance(vm)
        function setActiveInstance(vm) {
            const prevActiveInstance = activeInstance
            activeInstance = vm
            return () => {
                activeInstance = prevActiveInstance
            }
        }
        vm._vnode = vnode
        // Vue.prototype.__patch__ is injected in entry points
        // based on the rendering backend used.
        if (!prevVnode) {
            // initial render
            vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
        } else {
            // updates
            vm.$el = vm.__patch__(prevVnode, vnode)
        }
        restoreActiveInstance()
        // update __vue__ reference
        if (prevEl) {
            prevEl.__vue__ = null
        }
        if (vm.$el) {
            vm.$el.__vue__ = vm
        }
        // if parent is an HOC, update its $el as well
        if (vm.$vnode && vm.$parent && vm.$vnode === vm.$parent._vnode) {
            vm.$parent.$el = vm.$el
        }
        // updated hook is called by the scheduler to ensure that children are
        // updated in a parent's updated hook.
    }
    Vue.prototype.$forceUpdate = function () {
        const vm = this
        if (vm._watcher) {
            vm._watcher.update()
        }
    }
    Vue.prototype.$destroy = function () {
        const vm = this
        if (vm._isBeingDestroyed) {
            return
        }
        callHook(vm, 'beforeDestroy')
        vm._isBeingDestroyed = true
        // remove self from parent
        const parent = vm.$parent
        if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
            remove(parent.$children, vm)
        }
        // teardown watchers
        if (vm._watcher) {
            vm._watcher.teardown()
        }
        let i = vm._watchers.length
        while (i--) {
            vm._watchers[i].teardown()
        }
        // remove reference from data ob
        // frozen object may not have observer.
        if (vm._data.__ob__) {
            vm._data.__ob__.vmCount--
        }
        // call the last hook...
        vm._isDestroyed = true
        // invoke destroy hooks on current rendered tree
        vm.__patch__(vm._vnode, null)
        // fire destroyed hook
        callHook(vm, 'destroyed')
        // turn off all instance listeners.
        vm.$off()
        // remove __vue__ reference
        if (vm.$el) {
            vm.$el.__vue__ = null
        }
        // release circular reference (#6759)
        if (vm.$vnode) {
            vm.$vnode.parent = null
        }
    }
}

/**
 * 为Vue原型挂载$nextTick,_render方法
 */
renderMixin(Vue)
function renderMixin(Vue) {
    // install runtime convenience helpers
    installRenderHelpers(Vue.prototype)
    Vue.prototype.$nextTick = function (fn: Function) {
        return nextTick(fn, this)
    }
    Vue.prototype._render = function (): VNode {
        const vm = this
        const { render, _parentVnode } = vm.$options

        if (_parentVnode) {
            vm.$scopedSlots = normalizeScopedSlots(_parentVnode.data.scopedSlots, vm.$slots, vm.$scopedSlots)
        }

        // set parent vnode. this allows render functions to have access
        // to the data on the placeholder node.
        vm.$vnode = _parentVnode
        // render self
        let vnode
        try {
            // There's no need to maintain a stack because all render fns are called
            // separately from one another. Nested component's render fns are called
            // when parent component is patched.
            currentRenderingInstance = vm
            vnode = render.call(vm._renderProxy, vm.$createElement)
        } catch (e) {
            handleError(e, vm, `render`)
            // return error render result,
            // or previous vnode to prevent render error causing blank component
            /* istanbul ignore else */
            if (process.env.NODE_ENV !== 'production' && vm.$options.renderError) {
                try {
                    vnode = vm.$options.renderError.call(vm._renderProxy, vm.$createElement, e)
                } catch (e) {
                    handleError(e, vm, `renderError`)
                    vnode = vm._vnode
                }
            } else {
                vnode = vm._vnode
            }
        } finally {
            currentRenderingInstance = null
        }
        // if the returned array contains only a single node, allow it
        if (Array.isArray(vnode) && vnode.length === 1) {
            vnode = vnode[0]
        }
        // return empty vnode in case the render function errored out
        if (!(vnode instanceof VNode)) {
            if (process.env.NODE_ENV !== 'production' && Array.isArray(vnode)) {
                warn('Multiple root nodes returned from render function. Render function ' + 'should return a single root node.', vm)
            }
            vnode = createEmptyVNode()
        }
        // set parent
        vnode.parent = _parentVnode
        return vnode
    }
}